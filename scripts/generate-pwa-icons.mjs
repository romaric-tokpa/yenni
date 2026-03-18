#!/usr/bin/env node
import sharp from "sharp";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "public/icons");

const iconSvg = readFileSync(join(root, "public/icons/icon.svg"));
const maskableSvg = readFileSync(join(root, "public/icons/icon-maskable.svg"));

// Icônes standard (any) : 192, 384, 512 + 180 pour Apple
for (const size of [180, 192, 384, 512]) {
  const outPath = join(outDir, `icon-${size}.png`);
  await sharp(iconSvg).resize(size, size).png().toFile(outPath);
  console.log(`✓ Généré ${outPath}`);
}

// Icônes maskable (Android, etc.) : fond opaque pour meilleur rendu
for (const size of [192, 512]) {
  const outPath = join(outDir, `icon-maskable-${size}.png`);
  await sharp(maskableSvg).resize(size, size).png().toFile(outPath);
  console.log(`✓ Généré ${outPath} (maskable)`);
}
