#!/usr/bin/env node

import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import subsetFont from "subset-font";
import sharp from "sharp";

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(file) : [file];
  }));
  return files.flat().filter((file) => /\.(html|md|yml|js)$/.test(file));
}

const directories = ["_includes", "_layouts", "_pages", "_posts", "_projects", "_publications", "_misc", "_data", "assets/js"];
const sources = await Promise.all(directories.map(sourceFiles));
const usedClasses = new Set();
for (const file of sources.flat()) {
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(/\b(?:fa|ai)-[a-z0-9-]+\b/g)) usedClasses.add(match[0]);
}

const fontAwesome = await readFile("_sass/vendor/font-awesome/_variables.scss", "utf8");
const academicons = await readFile("assets/css/academicons.css", "utf8");
const fonts = [
  {
    source: "assets/fonts/fontawesome-webfont.ttf",
    output: "assets/fonts/fontawesome-subset.woff2",
    glyphs: [...fontAwesome.matchAll(/\$fa-var-([\w-]+):\s*"\\([a-f0-9]+)"/g)]
      .map((match) => ["fa-" + match[1], match[2]])
  },
  {
    source: "assets/fonts/academicons.ttf",
    output: "assets/fonts/academicons-subset.woff2",
    glyphs: [...academicons.matchAll(/\.(ai-[\w-]+):before\s*\{\s*content:\s*"\\([a-f0-9]+)"/g)]
      .map((match) => [match[1], match[2]])
  }
];

for (const font of fonts) {
  const characters = new Set(font.glyphs.filter(([name]) => usedClasses.has(name))
    .map(([, code]) => String.fromCodePoint(parseInt(code, 16))));
  if (characters.size === 0) throw new Error(`No icon glyphs found for ${font.source}`);
  const subset = await subsetFont(await readFile(font.source), [...characters].sort().join(""), {
    targetFormat: "woff2",
    preserveNameIds: [0, 13, 14]
  });
  await writeFile(font.output, subset);
  console.log(`${font.output}: ${characters.size} glyphs, ${subset.length} bytes`);
}

await sharp("images/social/facebook-logo-blue.png").resize({ width: 48 })
  .png({ compressionLevel: 9, palette: true }).toFile("images/social/facebook-logo-blue-48.png");
await sharp("images/social/linkedin-in-blue.png").resize({ height: 48 })
  .png({ compressionLevel: 9, palette: true }).toFile("images/social/linkedin-in-blue-56.png");
