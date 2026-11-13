#!/usr/bin/env node

// Audit the generated site and exercise keyboard flows without depending on
// analytics, video providers, CDN availability, or third-party comment widgets.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import axe from "axe-core";

const root = path.resolve(process.argv[2] ?? "_site");
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".jpg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
  ".json": "application/json", ".ico": "image/x-icon"
};
let origin;
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, origin).pathname);
    const candidate = path.resolve(root, `.${pathname}`);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403).end();
      return;
    }
    let file;
    for (const option of [candidate, `${candidate}.html`, path.join(candidate, "index.html")]) {
      if (await stat(option).then((value) => value.isFile(), () => false)) {
        file = option;
        break;
      }
    }
    if (!file) {
      response.writeHead(404).end();
      return;
    }
    const bytes = await readFile(file);
    response.setHeader("Content-Type", types[path.extname(file)] ?? "application/octet-stream");
    // Localize the production build's absolute links and asset URLs for this test server.
    response.end(path.extname(file) === ".html"
      ? bytes.toString().replaceAll("https://raghavsomani.github.io", origin)
      : bytes);
  } catch (error) {
    response.writeHead(500).end(error.message);
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const failures = [];
let audits = 0;

async function audit(page, label) {
  await settle(page);
  await page.addScriptTag({ content: axe.source });
  const results = await page.evaluate(async () => window.axe.run(document, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] }
  }));
  for (const violation of results.violations) {
    failures.push(`${label}: ${violation.id}\n${violation.nodes.map((node) =>
      `  ${node.target.join(" ")}: ${node.failureSummary}`).join("\n")}`);
  }
  audits++;
}

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations()
      .filter((animation) => animation.effect.getTiming().iterations !== Infinity)
      .map((animation) => animation.finished.catch(() => {})));
    if (window.jQuery) {
      await new Promise((resolve) => window.jQuery(":animated").promise().done(resolve));
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {})
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.route("**/*", async (route) => {
    if (new URL(route.request().url()).origin === origin) await route.continue();
    else await route.abort();
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(`${page.url()}: ${error.message}`));
  const routes = [
    "/", "/projects/", "/publications/", "/year-archive/", "/cv/", "/misc/",
    "/misc/2018-12-Montreal-Neurips/", "/misc/2019-12-Melbourne-WSDM/",
    "/misc/2019-12-Vancouver-Neurips/", "/publications/2020-09-25-MetaLearning_RMLR-5",
    "/posts/2020/02/blog-post-11/"
  ];

  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      const response = await page.goto(`${origin}${route}`, { waitUntil: "load" });
      assert.equal(response.status(), 200, route);
      await settle(page);
      await audit(page, `${width}px ${route}`);
      const heading = page.locator("#main-content");
      assert.equal(await heading.count(), 1, `${route}: missing/duplicate skip target`);
    }
  }

  await page.goto(origin);
  await settle(page);
  assert.equal(await page.locator('script[src*="mathjax"]').count(), 0, "Homepage loaded MathJax");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.textContent), "Skip to main content");
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => document.activeElement.id), "main-content", "Skip link did not move focus");

  const navToggle = page.getByRole("button", { name: "Open navigation menu" });
  const profiles = page.getByRole("button", { name: "Profiles", exact: true });
  await profiles.click();
  await navToggle.click();
  await page.setViewportSize({ width: 390, height: 780 });
  await settle(page);
  assert.equal(await profiles.getAttribute("aria-expanded"), "true", "Height resize closed Profiles");
  assert.equal(await page.locator(".greedy-nav__toggle").getAttribute("aria-expanded"), "true", "Height resize closed navigation");
  await audit(page, "390px open menus after height resize");
  await page.setViewportSize({ width: 414, height: 780 });
  await settle(page);
  assert.equal(await profiles.getAttribute("aria-expanded"), "true", "Same-breakpoint resize closed Profiles");
  assert.equal(await page.locator(".greedy-nav__toggle").getAttribute("aria-expanded"), "true", "Width resize lost navigation state");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".greedy-nav__toggle").getAttribute("aria-expanded"), "false");

  await page.goto(`${origin}/misc/2019-12-Melbourne-WSDM/`);
  await settle(page);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
  const photoBytes = await page.evaluate(() => performance.getEntriesByType("resource")
    .filter((resource) => resource.name.includes("/images/responsive/Melbourne-2019/"))
    .reduce((total, resource) => total + resource.decodedBodySize, 0));
  assert(photoBytes > 0 && photoBytes < 600000, `Mobile photo budget exceeded: ${photoBytes} bytes`);
  const photos = await page.locator(".page__content img").evaluateAll((images) => images.map((image) => ({
    src: image.currentSrc, width: image.getAttribute("width"), height: image.getAttribute("height")
  })));
  assert(photos.every((image) => image.src.includes("/responsive/") && image.width && image.height), "Gallery bypassed responsive images");

  const imageLink = page.getByRole("link", { name: "Yarra river, near the Conference Center.", exact: true });
  await imageLink.click();
  const dialog = page.getByRole("dialog", { name: "Image viewer" });
  await dialog.waitFor({ state: "visible" });
  assert(await dialog.evaluate((element) => element.matches(":modal")), "Lightbox is not a native modal");
  await audit(page, "Open lightbox");
  await page.getByRole("button", { name: "Next (Right arrow key)" }).click();
  await page.waitForFunction(() => document.querySelector(".mfp-counter").textContent === "2 of 3");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert(await imageLink.evaluate((element) => document.activeElement === element), "Lightbox did not return focus to its link");

  await page.goto(`${origin}/posts/2020/02/blog-post-11/`);
  const math = page.locator('script[src*="mathjax@4.1.3/"]');
  assert.equal(await math.count(), 1, "Mathematical article omitted MathJax");
  assert.match(await math.getAttribute("integrity"), /^sha384-[A-Za-z0-9+/]{64}$/);
  assert.equal(await math.getAttribute("crossorigin"), "anonymous");
  if (pageErrors.length) failures.push(`Browser JavaScript errors:\n${pageErrors.join("\n")}`);

  assert.equal(failures.length, 0, failures.join("\n\n"));
  console.log(`${audits} accessibility audits passed; skip link, menus, native lightbox and math loading passed.`);
  console.log(`Mobile Melbourne photographs: ${(photoBytes / 1000).toFixed(1)} KB (originals: 5359.0 KB).`);
} finally {
  if (browser) await browser.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
