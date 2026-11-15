#!/usr/bin/env node

import { cp, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mathjax } from "@mathjax/src/js/mathjax.js";
import { TeX } from "@mathjax/src/js/input/tex.js";
import { CHTML } from "@mathjax/src/js/output/chtml.js";
import { liteAdaptor } from "@mathjax/src/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "@mathjax/src/js/handlers/html.js";
import { AssistiveMmlHandler } from "@mathjax/src/js/a11y/assistive-mml.js";
import "@mathjax/src/js/util/asyncLoad/esm.js";
import "@mathjax/src/js/input/tex/base/BaseConfiguration.js";
import "@mathjax/src/js/input/tex/ams/AmsConfiguration.js";
import "@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js";
import "@mathjax/src/js/input/tex/boldsymbol/BoldsymbolConfiguration.js";
import "@mathjax/src/js/input/tex/configmacros/ConfigMacrosConfiguration.js";

const root = path.resolve(process.argv[2] ?? "_site");
const adaptor = liteAdaptor({ fontSize: 16 });
AssistiveMmlHandler(RegisterHTMLHandler(adaptor));

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? htmlFiles(file) : [file];
  }));
  return files.flat().filter((file) => file.endsWith(".html"));
}

// Kramdown emits script elements for math, alongside articles that use delimiters.
// Merge both forms in document order so macro definitions precede their uses.
function findLegacyMath(document) {
  const legacyMath = new document.options.MathList();
  for (const node of adaptor.tags(adaptor.root(document.document), "script")) {
    const type = adaptor.getAttribute(node, "type") ?? "";
    if (!type.startsWith("math/tex")) continue;
    const math = new document.options.MathItem(adaptor.textContent(node), document.inputJax[0], /mode=display/.test(type));
    const text = adaptor.text("");
    adaptor.replace(text, node);
    math.start = { node: text, delim: "", n: 0 };
    math.end = { node: text, delim: "", n: 0 };
    legacyMath.push(math);
  }
  document.math.merge(legacyMath);
}

const renderedPages = [];
let expressions = 0;
for (const file of await htmlFiles(root)) {
  const source = await readFile(file, "utf8");
  if (!source.includes("/assets/js/mathjax-config.js")) continue;
  try {
    const dom = await mathjax.handleRetriesFor(() => adaptor.parse(source, "text/html"));
    const configScript = adaptor.tags(adaptor.root(dom), "script")
      .find((script) => (adaptor.getAttribute(script, "src") ?? "").includes("/assets/js/mathjax-config.js"));
    if (!configScript) continue;
    const configPath = new URL(adaptor.getAttribute(configScript, "src"), "https://localhost").pathname;
    const baseurl = (process.argv[3] ?? configPath.replace(/\/assets\/js\/mathjax-config\.js$/, "")).replace(/\/$/, "");
    // A fresh input jax keeps article macros and equation counters scoped to a page.
    const input = new TeX({
      packages: ["base", "ams", "newcommand", "boldsymbol", "configmacros"],
      inlineMath: [["$", "$"], ["\\(", "\\)"]],
      displayMath: [["$$", "$$"], ["\\[", "\\]"]],
      processEscapes: true,
      formatError(_jax, error) { throw error; }
    });
    const output = new CHTML({ fontURL: `${baseurl}/assets/fonts/mathjax` });
    const document = mathjax.document(dom, {
      InputJax: input,
      OutputJax: output,
      ignoreHtmlClass: "tex2jax_ignore|mathjax_ignore",
      renderActions: { findScript: [10, findLegacyMath, ""] }
    });
    await document.renderPromise();

    for (const math of document.math) {
      if (math.display) {
        adaptor.setAttribute(math.typesetRoot, "tabindex", "0");
        adaptor.setAttribute(math.typesetRoot, "role", "group");
        adaptor.setAttribute(math.typesetRoot, "aria-label", "Equation");
      }
      const mml = adaptor.tags(math.typesetRoot, "math")[0];
      if (mml) {
        const row = adaptor.node("mrow", {}, [...adaptor.childNodes(mml)]);
        const annotation = adaptor.node("annotation", { encoding: "application/x-tex" }, [adaptor.text(math.math)]);
        adaptor.append(mml, adaptor.node("semantics", {}, [row, annotation]));
      }
      expressions++;
    }
    for (const script of adaptor.tags(adaptor.root(document.document), "script")) {
      const src = adaptor.getAttribute(script, "src") ?? "";
      if (src.includes("/mathjax-config.js") || src.includes("/npm/mathjax@")) adaptor.remove(script);
    }
    const html = adaptor.root(document.document);
    adaptor.setAttribute(html, "data-math-prerendered", "true");
    renderedPages.push([file, adaptor.doctype(document.document) + "\n" + adaptor.outerHTML(html)]);
  } catch (error) {
    throw new Error(`Math pre-rendering failed in ${path.relative(root, file)}: ${error.message}`, { cause: error });
  }
}

if (renderedPages.length) {
  const fontDirectory = fileURLToPath(new URL("../node_modules/@mathjax/mathjax-newcm-font/chtml/woff2/", import.meta.url));
  await cp(fontDirectory, path.join(root, "assets/fonts/mathjax"), { recursive: true });
  for (const [file, html] of renderedPages) await writeFile(file, html);
}
console.log(`Pre-rendered ${expressions} mathematical expressions across ${renderedPages.length} pages.`);
