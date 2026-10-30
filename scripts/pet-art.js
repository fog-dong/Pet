// STATUS: implemented, W16 素材整理（纯色底抠图 → 裁白边 → 等比缩放 → 透明 PNG）
// 用法：node scripts/pet-art.js <源图.png> <输出名> [--out <目录>] [--size 宽x高]
// 默认输出 assets/bundles/art/pets/<name>.png，320×320。
const fs = require('fs');
const path = require('path');
const { decodePng, encodePng } = require('./png-codec');
const { keyOut, trim } = require('./pet-art-image');
const { toCanvas } = require('./pet-art-resize');

const PET_DIR = path.join(__dirname, '..', 'assets', 'bundles', 'art', 'pets');

function readOptions(argv) {
  const rest = [];
  let outDir = PET_DIR;
  let width = 320;
  let height = 320;
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--out') {
      outDir = path.resolve(argv[++i] ?? outDir);
    } else if (token === '--size') {
      const [w, h] = (argv[++i] ?? '').split('x').map((value) => Number(value));
      if (w > 0 && h > 0) {
        width = Math.round(w);
        height = Math.round(h);
      }
    } else {
      rest.push(token);
    }
  }
  return { rest, outDir, width, height };
}

const { rest, outDir, width, height } = readOptions(process.argv.slice(2));
const [src, name] = rest;
if (!src || !name) {
  throw new Error('用法：node scripts/pet-art.js <源图.png> <输出名> [--out <目录>] [--size 宽x高]');
}
const img = keyOut(decodePng(src));
const box = trim(img);
const png = encodePng(width, height, toCanvas(img, box, width, height));
fs.mkdirSync(outDir, { recursive: true });
const target = path.join(outDir, `${name}.png`);
fs.writeFileSync(target, png);
process.stdout.write(
  `${name}.png  ${box.w}x${box.h} → ${width}x${height}  ${(png.length / 1024).toFixed(1)} KB\n`,
);
