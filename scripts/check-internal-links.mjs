#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const outputDirectory = path.resolve(process.argv[2] ?? "_site");
const siteUrl = new URL(process.env.SITE_URL ?? "https://raghavsomani.github.io/");

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  }));
  return nested.flat();
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function pageUrl(relativePath) {
  if (relativePath === "index.html") return "/";
  if (relativePath.endsWith("/index.html")) {
    return `/${relativePath.slice(0, -"index.html".length)}`;
  }
  return `/${relativePath}`;
}

function candidatePaths(pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    decodedPath = pathname;
  }

  const relativePath = decodedPath.replace(/^\/+/, "");
  if (!relativePath) return ["index.html"];
  if (relativePath.endsWith("/")) return [`${relativePath}index.html`];

  return [
    relativePath,
    `${relativePath}.html`,
    `${relativePath}/index.html`
  ];
}

function extractAttributes(html) {
  const values = [];
  const attributePattern = /\b(?:href|src|poster)\s*=\s*["']([^"']+)["']/gi;
  const visibleHtml = html.replace(/<!--[\s\S]*?-->/g, "");
  for (const match of visibleHtml.matchAll(attributePattern)) values.push(match[1].trim());
  return values;
}

function extractAnchors(html) {
  const anchors = new Set();
  const anchorPattern = /\b(?:id|name)\s*=\s*["']([^"']+)["']/gi;
  const visibleHtml = html.replace(/<!--[\s\S]*?-->/g, "");
  for (const match of visibleHtml.matchAll(anchorPattern)) anchors.add(match[1]);
  return anchors;
}

const files = await walk(outputDirectory);
const relativeFiles = new Set(files.map((file) => toPosix(path.relative(outputDirectory, file))));
const htmlFiles = [...relativeFiles].filter((file) => file.endsWith(".html"));
const anchorCache = new Map();
const failures = new Set();

for (const htmlFile of htmlFiles) {
  const html = await readFile(path.join(outputDirectory, htmlFile), "utf8");

  for (const rawTarget of extractAttributes(html)) {
    if (!rawTarget || rawTarget === "#" || rawTarget.startsWith("//")) continue;

    let targetUrl;
    try {
      targetUrl = new URL(rawTarget, new URL(pageUrl(htmlFile), siteUrl));
    } catch {
      failures.add(`${htmlFile}: invalid URL ${JSON.stringify(rawTarget)}`);
      continue;
    }

    if (!/^https?:$/.test(targetUrl.protocol)) continue;
    if (targetUrl.hostname.toLowerCase() !== siteUrl.hostname.toLowerCase()) continue;

    const candidates = candidatePaths(targetUrl.pathname);
    const targetFile = candidates.find((candidate) => relativeFiles.has(candidate));
    if (!targetFile) {
      failures.add(`${htmlFile}: ${rawTarget} (no matching ${candidates.join(", ")})`);
      continue;
    }

    if (!targetUrl.hash || !targetFile.endsWith(".html")) continue;

    let fragment;
    try {
      fragment = decodeURIComponent(targetUrl.hash.slice(1));
    } catch {
      fragment = targetUrl.hash.slice(1);
    }
    if (!fragment) continue;

    if (!anchorCache.has(targetFile)) {
      const targetHtml = await readFile(path.join(outputDirectory, targetFile), "utf8");
      anchorCache.set(targetFile, extractAnchors(targetHtml));
    }
    if (!anchorCache.get(targetFile).has(fragment)) {
      failures.add(`${htmlFile}: ${rawTarget} (missing fragment #${fragment})`);
    }
  }
}

if (failures.size) {
  console.error(`Internal link check failed with ${failures.size} issue(s):`);
  for (const failure of [...failures].sort()) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Internal link check passed for ${htmlFiles.length} HTML files.`);
}
