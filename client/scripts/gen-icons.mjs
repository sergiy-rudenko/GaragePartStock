// One-off icon generator — NOT part of the build.
//
// Regenerates the favicon / touch-icon / PWA icon set in client/public/ from
// client/public/logo.png. `sharp` is only needed to run this script and is
// deliberately NOT a dependency of the app; install it ad-hoc when you need to
// regenerate icons, e.g.:
//
//   npm i sharp --no-save && node scripts/gen-icons.mjs
//
// Outputs: favicon-16x16.png, favicon-32x32.png, apple-touch-icon.png (180),
// android-chrome-192x192.png, android-chrome-512x512.png, and a multi-size
// favicon.ico (16/32/48, PNG-encoded entries).

import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const src = join(publicDir, 'logo.png');

const PNG_TARGETS = [
  { file: 'favicon-16x16.png', size: 16 },
  { file: 'favicon-32x32.png', size: 32 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'android-chrome-192x192.png', size: 192 },
  { file: 'android-chrome-512x512.png', size: 512 },
];

const ICO_SIZES = [16, 32, 48];

// Resize the source square logo to `size` and return PNG bytes.
function pngBuffer(size) {
  return sharp(src).resize(size, size, { fit: 'cover' }).png().toBuffer();
}

// Assemble a Windows .ico that embeds a PNG for each size.
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(images.length, 4);

  const dir = Buffer.alloc(16 * images.length);
  let offset = 6 + 16 * images.length;
  images.forEach((img, i) => {
    const b = 16 * i;
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, b + 0); // width (0 = 256)
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, b + 1); // height
    dir.writeUInt8(0, b + 2);            // palette count
    dir.writeUInt8(0, b + 3);            // reserved
    dir.writeUInt16LE(1, b + 4);         // color planes
    dir.writeUInt16LE(32, b + 6);        // bits per pixel
    dir.writeUInt32LE(img.data.length, b + 8);  // data size
    dir.writeUInt32LE(offset, b + 12);          // data offset
    offset += img.data.length;
  });

  return Buffer.concat([header, dir, ...images.map((i) => i.data)]);
}

async function main() {
  for (const { file, size } of PNG_TARGETS) {
    await writeFile(join(publicDir, file), await pngBuffer(size));
    console.log('wrote', file);
  }

  const icoImages = [];
  for (const size of ICO_SIZES) icoImages.push({ size, data: await pngBuffer(size) });
  await writeFile(join(publicDir, 'favicon.ico'), buildIco(icoImages));
  console.log('wrote favicon.ico');
}

main().catch((err) => { console.error(err); process.exit(1); });
