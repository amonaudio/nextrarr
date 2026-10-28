#!/usr/bin/env node
/**
 * Generate the canonical nEXTrarr icons from public/logo.svg.
 *
 * The same brand mark is used by:
 *   - the header (public/logo.svg directly)
 *   - the browser tab (public/favicon.png)
 *   - the Unraid/Docker template (unraid/icon.png)
 *
 * Usage:
 *   node scripts/generate-icons.mjs
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'public', 'logo.svg');

const outputs = [
  { file: path.join(root, 'public', 'favicon.png'), size: 256 },
  { file: path.join(root, 'unraid', 'icon.png'), size: 256 },
];

for (const { file, size } of outputs) {
  await sharp(source)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(file);
  console.log(`wrote ${path.relative(root, file)} (${size}x${size})`);
}
