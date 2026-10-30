// STATUS: implemented, W16 宠物立绘整理（纯色底抠图 → 裁白边 → 缩放 → 透明 PNG）
// 用法：node scripts/pet-art.js <源图.png> <输出名>，例如 pet-art.js corgi_raw.png corgi
const fs = require('fs');
const path = require('path');
const { decodePng, encodePng } = require('./png-codec');
const { keyOut, trim } = require('./pet-art-image');
const { CANVAS, toSquare } = require('./pet-art-resize');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'bundles', 'art', 'pets');

const [src, name] = process.argv.slice(2);
if (!src || !name) {
  throw new Error('用法：node scripts/pet-art.js <源图.png> <输出名>');
}
const img = keyOut(decodePng(src));
const box = trim(img);
const png = encodePng(CANVAS, CANVAS, toSquare(img, box));
fs.mkdirSync(OUT_DIR, { recursive: true });
const target = path.join(OUT_DIR, `${name}.png`);
fs.writeFileSync(target, png);
process.stdout.write(`${name}.png  ${box.w}x${box.h} → ${CANVAS}x${CANVAS}  ${(png.length / 1024).toFixed(1)} KB\n`);
