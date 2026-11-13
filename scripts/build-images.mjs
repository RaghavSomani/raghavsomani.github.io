#!/usr/bin/env node

// Originals remain the full-resolution lightbox targets. Commit generated copies
// and metadata so GitHub Pages does not need an image-processing build plugin.
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const galleries = ["Melbourne-2019", "Montreal-2018", "Vancouver-2019"];
const widths = [480, 960, 1600];
const images = {};
const generatedFiles = new Set();
const previous = await readFile("_data/responsive_images.json", "utf8")
  .then(JSON.parse).catch((error) => { if (error.code === "ENOENT") return {}; throw error; });
const heroImages = new Set();
for (const name of await readdir("_misc")) {
  if (!name.endsWith(".md")) continue;
  const content = await readFile(path.join("_misc", name), "utf8");
  const match = content.match(/^\s+overlay_image:\s*([^\r\n]+)/m);
  if (match) heroImages.add(match[1].trim().replace(/^["']|["']$/g, ""));
}
let generated = 0;

for (const gallery of galleries) {
  const directory = path.join("images", gallery);
  const output = path.join("images", "responsive", gallery);
  await mkdir(output, { recursive: true });
  for (const name of (await readdir(directory)).filter((name) => /\.jpe?g$/i.test(name)).sort()) {
    const source = path.join(directory, name);
    const metadata = await sharp(source).metadata();
    const sideways = metadata.orientation >= 5 && metadata.orientation <= 8;
    const width = sideways ? metadata.height : metadata.width;
    const height = sideways ? metadata.width : metadata.height;
    const variants = [];
    const imageWidths = heroImages.has(`${gallery}/${name}`) ? [...widths, 2400] : widths;
    for (const target of [...new Set(imageWidths.map((size) => Math.min(size, width)))]) {
      const basename = `${path.parse(name).name}-${target}`;
      const jpeg = `responsive/${gallery}/${basename}.jpg`;
      const webp = `responsive/${gallery}/${basename}.webp`;
      await sharp(source).rotate().resize({ width: target, withoutEnlargement: true })
        .jpeg({ quality: 80, mozjpeg: true }).toFile(path.join("images", jpeg));
      await sharp(source).rotate().resize({ width: target, withoutEnlargement: true })
        .webp({ quality: 78 }).toFile(path.join("images", webp));
      variants.push({ width: target, jpeg, webp });
      generatedFiles.add(jpeg);
      generatedFiles.add(webp);
      generated += 2;
    }
    images[`${gallery}/${name}`] = { width, height, variants };
  }
}

// Remove only obsolete files previously owned by this generator's manifest.
const generatedRoot = `${path.resolve("images/responsive")}${path.sep}`;
for (const image of Object.values(previous)) {
  for (const variant of image.variants) {
    for (const name of [variant.jpeg, variant.webp]) {
      const filename = path.resolve("images", name);
      if (!filename.startsWith(generatedRoot)) throw new Error(`Invalid generated path: ${name}`);
      if (!generatedFiles.has(name)) await rm(filename, { force: true });
    }
  }
}

await writeFile("_data/responsive_images.json", `${JSON.stringify(images, null, 2)}\n`);
console.log(`Generated ${generated} responsive files for ${Object.keys(images).length} photographs.`);
