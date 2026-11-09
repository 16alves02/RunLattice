import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "public", "RunLattice_Logo.jfif");
const output = path.join(root, "public");

const metadata = await sharp(source).metadata();
if (!metadata.width || !metadata.height) {
  throw new Error("Could not read dimensions from public/RunLattice_Logo.jfif");
}

// The uploaded logo is a landscape wordmark. Crop the original raster artwork
// around its left-hand lattice symbol so it remains recognisable at favicon size.
const cropSide = Math.round(Math.min(metadata.width * 0.29, metadata.height * 0.52));
const crop = {
  left: Math.round(metadata.width * 0.105),
  top: Math.round(metadata.height * 0.24),
  width: cropSide,
  height: cropSide,
};

if (
  crop.left < 0 ||
  crop.top < 0 ||
  crop.left + crop.width > metadata.width ||
  crop.top + crop.height > metadata.height
) {
  throw new Error("The logo crop is outside the source image bounds.");
}

async function renderPng(size) {
  return sharp(source)
    .extract(crop)
    .resize(size, size, { fit: "contain", background: "#ffffff" })
    .flatten({ background: "#ffffff" })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function savePng(filename, size) {
  const buffer = await renderPng(size);
  await writeFile(path.join(output, filename), buffer);
}

await Promise.all([
  savePng("favicon-16x16.png", 16),
  savePng("favicon-32x32.png", 32),
  savePng("apple-touch-icon.png", 180),
  savePng("icon-192.png", 192),
  savePng("icon-512.png", 512),
]);

// A standards-compatible ICO container with the 32x32 PNG image resource.
const faviconPng = await renderPng(32);
const icoHeader = Buffer.alloc(22);
icoHeader.writeUInt16LE(0, 0); // Reserved
icoHeader.writeUInt16LE(1, 2); // ICO image type
icoHeader.writeUInt16LE(1, 4); // Number of images
icoHeader[6] = 32; // Width
icoHeader[7] = 32; // Height
icoHeader[8] = 0; // Color count
icoHeader[9] = 0; // Reserved
icoHeader.writeUInt16LE(1, 10); // Color planes
icoHeader.writeUInt16LE(32, 12); // Bits per pixel
icoHeader.writeUInt32LE(faviconPng.length, 14); // Image byte length
icoHeader.writeUInt32LE(22, 18); // Image offset
await writeFile(path.join(output, "favicon.ico"), Buffer.concat([icoHeader, faviconPng]));

console.log("Generated RunLattice raster icons from public/RunLattice_Logo.jfif");
