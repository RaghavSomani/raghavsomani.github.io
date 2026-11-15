#!/usr/bin/env node

// Run with CHROME_BIN=/path/to/chrome node scripts/check-lightbox.mjs [site-root].
// Uses only Node.js and a local Chromium browser; no external requests are needed.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(process.argv[2] ?? fileURLToPath(new URL("../", import.meta.url)));
const sourceFiles = [
  "assets/js/vendor/jquery/jquery-4.0.0.min.js",
  "assets/js/plugins/jquery.magnific-popup.js",
  "assets/js/_image-viewer.js"
];
const sources = await Promise.all(sourceFiles.map((file) => readFile(path.join(root, file), "utf8")));
const variants = {
  source: {
    main: await readFile(path.join(root, "assets/js/_main.js"), "utf8"),
    viewer: sources.join("\n")
  },
  bundle: {
    main: await readFile(path.join(root, "assets/js/main.min.js"), "utf8"),
    viewer: await readFile(path.join(root, "assets/js/image-viewer.min.js"), "utf8")
  }
};
// Optionally exercise an isolated Jekyll build with Staticman and published comments.
const staticmanComments = process.env.STATICMAN_FIXTURE
  ? (await readFile(process.env.STATICMAN_FIXTURE, "utf8")).match(/<body>([\s\S]*)<\/body>/i)[1]
  : "";
const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=", "base64");

async function checkLightbox() {
  const failures = [];
  let passed = 0;
  window.__injected = 0;
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const waitFor = async (condition) => {
    for (let i = 0; i < 300; i++) {
      if (condition()) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error("Timed out waiting for the image lifecycle");
  };
  const test = async (name, run) => {
    try { await run(); passed++; }
    catch (error) { failures.push(`${name}: ${error.message}`); }
    finally {
      $.magnificPopup.close();
      window.__injected = 0;
    }
  };
  const origin = location.origin;
  const payloads = [
    '/missing"><img src="/marker" onerror="window.__injected++">.jpg',
    '/missing"><img src="/marker" onerror="window.__injected++">.png',
    '/missing"><svg onload="window.__injected++"></svg>.jpg',
    "/missing' onmouseover='window.__injected++' data-end='.jpg",
    '/missing?x=&quot;&y=&#34;.jpg',
    '/missing/$` onpointerenter=window.__injected++ data-x=.jpg',
    "/missing/$&$'?x=a&y=b.jpg"
  ].map((url) => origin + url);
  const safeError = (popup, src) => {
    const preloader = popup.preloader[0];
    assert(preloader.querySelectorAll("*").length === 1, "URL created extra error elements");
    const link = preloader.querySelector("a");
    assert(link && link.attributes.length === 1, "URL created an event or other attribute");
    assert(link.getAttribute("href") === src, "Error link changed the source URL");
    assert(window.__injected === 0, "URL event handler executed");
  };

  // Exercise the actual plugin with a legacy link-bearing error template too.
  for (const src of payloads) {
    for (const quote of ['"', "'"]) {
      await test(`fresh error, ${quote} template, ${src}`, async () => {
        $.magnificPopup.open({
          items: { src, type: "image" },
          image: { tError: `<a href=${quote}%url%${quote}>Image</a> could not be loaded.` }
        });
        const popup = $.magnificPopup.instance;
        await waitFor(() => popup.currItem.loadError);
        safeError(popup, src);
        assert(popup.currItem.src === src, "Image request source was modified");
      });
      await test(`already failed error, ${quote} template, ${src}`, async () => {
        // A template without an image slot preserves the existing failed state,
        // deterministically covering getImage's immediate error branch.
        $.magnificPopup.open({
          items: { src, type: "image" },
          image: {
            markup: '<div class="mfp-figure"></div>',
            tError: `<a href=${quote}%url%${quote}>Image</a> could not be loaded.`
          },
          callbacks: { elementParse(item) { item.hasSize = item.loadError = true; } }
        });
        safeError($.magnificPopup.instance, src);
      });
    }
  }

  await test("Staticman author links stay ordinary links", async () => {
    for (const link of document.querySelectorAll(".page__comments a, .js-comment a")) {
      const click = $.Event("click");
      $(link).triggerHandler(click);
      assert(!click.isDefaultPrevented() || link.getAttribute("href").startsWith("#"), "Comment website link was intercepted");
      assert(!$.magnificPopup.instance.isOpen, "Comment link opened the lightbox");
      if (!link.classList.contains("explicit")) {
        assert(!link.classList.contains("image-popup"), "Comment link joined automatic classification");
      }
    }
    assert(window.__injected === 0, "Initially escaped comment markup executed");
  });

  await test("authored gallery, failure message and successful navigation", async () => {
    $("#good").triggerHandler("click");
    const popup = $.magnificPopup.instance;
    await waitFor(() => popup.currItem.loaded);
    assert(!popup.currItem.loadError && popup.currItem.img[0].naturalWidth > 0, "Valid image failed");
    assert(popup.items.length === 3, "Comment links entered the authored gallery");
    await waitFor(() => popup.items[1].loadError);
    popup.next();
    await waitFor(() => popup.currItem.loadError && popup.container.hasClass("mfp-s-error"));
    assert(popup.preloader.text() === "Image #2 could not be loaded.", "Incorrect fixed error text/counter");
    assert(popup.preloader.find("*").length === 0, "Site error contains URL-derived markup");
    popup.next();
    await waitFor(() => popup.currItem.loaded);
    assert(!popup.currItem.loadError, "Explicit authored image link failed");
    assert(popup.currItem.el[0].id === "explicit", "Explicit image link lost gallery membership");
  });

  await test("gallery navigation into a failed malicious item", async () => {
    const src = payloads[0];
    $.magnificPopup.open({
      items: [{ src: "/good.png", type: "image" }, { src, type: "image" }],
      gallery: { enabled: true, preload: [0, 1] }
    });
    const popup = $.magnificPopup.instance;
    await waitFor(() => popup.items[1].loadError);
    popup.next();
    await waitFor(() => popup.currItem.loadError && popup.container.hasClass("mfp-s-error"));
    safeError(popup, src);
    popup.prev();
    await waitFor(() => popup.currItem.loaded);
    assert(!popup.currItem.loadError, "Navigation back to valid image failed");
  });

  document.querySelector("#result").textContent = JSON.stringify({ passed, failures });
}

const escapeAttribute = (value) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const server = createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  const [, variant, asset] = url.pathname.split("/");
  if (variants[variant] && ["main.js", "image-viewer.min.js"].includes(asset)) {
    response.setHeader("Content-Type", "text/javascript");
    response.end(variants[variant][asset === "main.js" ? "main" : "viewer"]);
  } else if (url.pathname === "/good.png") {
    response.setHeader("Content-Type", "image/png");
    response.end(pixel);
  } else if (variants[variant] && !asset) {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const malicious = escapeAttribute(`${origin}/missing"><img src="/marker" onerror="window.__injected++">.jpg`);
    response.setHeader("Content-Type", "text/html");
    response.setHeader("Content-Security-Policy", "img-src 'self'");
    response.end(`<!doctype html><html><body>
      <main id="main"><section class="page__content">
        <a id="good" href="/good.png">Good image</a>
        <a id="missing" href="/missing.jpg">Missing image</a>
      </section><div class="page__comments"><article class="js-comment">
        <h3 class="comment__author"><a href="${malicious}">Comment author</a></h3>
        <a href="/good.png">Ordinary image-suffixed website</a>
        <a class="image-popup explicit" href="${malicious}">Explicit comment class</a>
      </article></div></main>
      ${staticmanComments}
      <aside><a id="explicit" class="image-popup" href="/good.png?manual=1">Explicit authored image</a></aside>
      <article class="js-comment"><a href="${malicious}">Standalone comment</a></article>
      <pre id="result">pending</pre>
      <script src="/${variant}/main.js"></script>
    </body></html>`);
  } else {
    response.writeHead(404);
    response.end("Missing image");
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {})
  });
  for (const variant of Object.keys(variants)) {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${server.address().port}/${variant}/`);
      await page.waitForFunction(() => Boolean(window.jQuery?.magnificPopup));
      await page.evaluate(checkLightbox);
      const { passed, failures } = JSON.parse(await page.locator("#result").textContent());
      assert.deepEqual(failures, [], `${variant}: ${failures.join("\n")}`);
      console.log(`${variant}: ${passed} lightbox security and compatibility checks passed.`);

      for (const shouldFail of [false, true]) {
        const delayedContext = await browser.newContext();
        try {
          let releaseDownload;
          const download = new Promise((resolve) => { releaseDownload = resolve; });
          await delayedContext.route("**/image-viewer.min.js", async (route) => {
            await download;
            if (shouldFail) await route.abort();
            else await route.continue();
          });
          const delayedPage = await delayedContext.newPage();
          const fixtureUrl = `http://127.0.0.1:${server.address().port}/${variant}/`;
          await delayedPage.goto(fixtureUrl, { waitUntil: "domcontentloaded" });
          await delayedPage.locator("#good").click();
          assert.equal(delayedPage.url(), fixtureUrl, "Click navigated before viewer download finished");
          releaseDownload();
          if (shouldFail) {
            await delayedPage.waitForURL(`http://127.0.0.1:${server.address().port}/good.png`);
          } else {
            await delayedPage.getByRole("dialog", { name: "Image viewer" }).waitFor({ state: "visible" });
            await delayedPage.keyboard.press("Escape");
          }
        } finally {
          await delayedContext.close();
        }
      }
      console.log(`${variant}: delayed viewer and download-failure fallback passed.`);
    } finally {
      await context.close();
    }
  }
} finally {
  if (browser) await browser.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
