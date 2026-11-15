#!/usr/bin/env node

// Audit the generated site and exercise keyboard flows without depending on
// analytics, video providers, CDN availability, or third-party comment widgets.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import axe from "axe-core";
import { createPreviewServer } from "./preview-server.mjs";

const server = createPreviewServer(process.argv[2] ?? "_site");
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
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
  page.on("response", (response) => {
    if (new URL(response.url()).origin === origin && response.status() >= 400) {
      pageErrors.push(`${response.status()}: ${response.url()}`);
    }
  });
  const routes = [
    "/", "/projects/", "/publications/", "/year-archive/", "/cv/", "/misc/",
    "/misc/2018-12-Montreal-Neurips/", "/misc/2019-12-Melbourne-WSDM/",
    "/misc/2019-12-Vancouver-Neurips/", "/publications/2020-09-25-MetaLearning_RMLR-5",
    "/projects/2020-12-08-project-4",
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
      assert.equal(await page.locator(".page__comments, #disqus_thread").count(), 0, `${route}: comments section remains`);
      assert.equal(await page.locator('script[src*="disqus"]').count(), 0, `${route}: Disqus script remains`);
      if (await page.locator("a.image-popup").count()) {
        await page.waitForFunction(() => Boolean(window.jQuery?.magnificPopup));
      } else {
        assert.equal(await page.locator('script[src*="image-viewer.min.js"]').count(), 0, `${route}: unnecessary image viewer loaded`);
        assert.equal(await page.evaluate(() => typeof window.jQuery), "undefined", `${route}: unnecessary jQuery loaded`);
      }
      const videos = await page.locator('.page__content iframe[src*="youtube.com/embed/"]').evaluateAll((frames) =>
        frames.map((frame) => ({ width: frame.clientWidth, height: frame.clientHeight })));
      assert(videos.every((video) => video.width <= width && Math.abs(video.width / video.height - 16 / 9) < 0.02), `${route}: video sizing failed`);
    }
  }

  await page.goto(origin);
  await settle(page);
  assert.equal(await page.locator('script[src*="mathjax"]').count(), 0, "Homepage loaded MathJax");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.textContent), "Skip to main content");
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => document.activeElement.id), "main-content", "Skip link did not move focus");

  await page.evaluate(() => {
    window.audioPlayCalls = 0;
    document.getElementById("name_audio").play = () => {
      window.audioPlayCalls++;
      return Promise.resolve();
    };
  });
  const pronunciation = page.getByRole("button", { name: "Play the pronunciation of Raghav Somani" });
  await pronunciation.click();
  assert.equal(await page.evaluate(() => window.audioPlayCalls), 1, "Pronunciation control did not play audio");
  await page.evaluate(() => {
    document.getElementById("name_audio").play = () => Promise.reject(new Error("Playback unavailable"));
  });
  await pronunciation.click();
  assert.match(await page.locator("#name-audio-status").textContent(), /could not be played/, "Audio failure was not reported");

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
  await settle(page);
  assert.equal(await page.locator('script[src*="mathjax"]').count(), 0, "Article loads client-side MathJax");
  assert.equal(await page.locator('script[type^="math/tex"]').count(), 0, "Article contains unrendered math");
  const equations = await page.locator("mjx-container").count();
  assert(equations > 200, "Pre-rendered article lost equations");
  assert.equal(await page.locator("mjx-assistive-mml math").count(), equations, "Equations lack accessible MathML");
  assert.equal(await page.locator('annotation[encoding="application/x-tex"]').count(), equations, "Equations lack original TeX");
  assert.equal(await page.locator("mjx-merror, merror").count(), 0, "Article contains math errors");
  const displayMath = page.locator('mjx-container[display="true"]');
  const wideIndex = await displayMath.evaluateAll((equations) => equations.findIndex((equation) =>
    equation.scrollWidth > equation.clientWidth + 1));
  assert(wideIndex >= 0, "Wide-equation keyboard check has no scrollable equation");
  await displayMath.nth(wideIndex).focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction((index) => document.querySelectorAll('mjx-container[display="true"]')[index].scrollLeft > 0, wideIndex);
  const fontResources = await page.evaluate(() => performance.getEntriesByType("resource")
    .filter((resource) => resource.name.includes("/assets/fonts/")).map((resource) => resource.name));
  assert(fontResources.some((url) => url.endsWith("fontawesome-subset.woff2")), "Icon font subset was not loaded");
  assert(fontResources.every((url) => url.includes("-subset.woff2") || url.includes("/fonts/mathjax/")), "Full icon font loaded");

  const noScriptContext = await browser.newContext({ javaScriptEnabled: false });
  await noScriptContext.route("**/*", async (route) => {
    if (new URL(route.request().url()).origin === origin) await route.continue();
    else await route.abort();
  });
  const noScriptPage = await noScriptContext.newPage();
  await noScriptPage.goto(`${origin}/posts/2020/02/blog-post-11/`);
  assert.equal(await noScriptPage.locator("mjx-container").count(), equations, "Math requires browser JavaScript");
  await noScriptContext.close();
  if (pageErrors.length) failures.push(`Browser JavaScript errors:\n${pageErrors.join("\n")}`);

  assert.equal(failures.length, 0, failures.join("\n\n"));
  console.log(`${audits} accessibility audits passed; skip link, menus, native lightbox, icon subsets and pre-rendered math passed.`);
  console.log(`Mobile Melbourne photographs: ${(photoBytes / 1000).toFixed(1)} KB (originals: 5359.0 KB).`);
} finally {
  if (browser) await browser.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
