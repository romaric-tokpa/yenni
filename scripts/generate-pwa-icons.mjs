#!/usr/bin/env node
import sharp from "sharp";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const svgPath = join(root, "public/icons/icon.svg");
const outDir = join(root, "public/icons");

const svg = readFileSync(svgPath);

for (const size of [192, 512]) {
  const outPath = join(outDir, `icon-${size}.png`);
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(outPath);
  console.log(`✓ Généré ${outPath}`);
}
