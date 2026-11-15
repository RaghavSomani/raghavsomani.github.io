#!/usr/bin/env node

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".jpg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
  ".json": "application/json", ".ico": "image/x-icon", ".pdf": "application/pdf",
  ".mp3": "audio/mpeg", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8"
};

export function createPreviewServer(directory) {
  const root = path.resolve(directory);
  return createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      const candidate = path.resolve(root, `.${pathname}`);
      if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        response.writeHead(403).end();
        return;
      }

      let file;
      // GitHub Pages resolves extensionless permalinks to generated .html files.
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
      const origin = new URL(`http://${request.headers.host}`).origin;
      const content = path.extname(file) === ".html"
        ? bytes.toString().replaceAll("https://raghavsomani.github.io", origin)
        : bytes;
      response.setHeader("Content-Type", types[path.extname(file)] ?? "application/octet-stream");
      response.end(request.method === "HEAD" ? undefined : content);
    } catch (error) {
      response.writeHead(error instanceof URIError ? 400 : 500).end(error.message);
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] ?? 4000);
  const server = createPreviewServer(process.argv[3] ?? "_site");
  server.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () => console.log(`Preview http://localhost:${port}/`));
}
