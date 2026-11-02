// STATUS: implemented, W16 素材整理（纯色底抠图 → 裁白边 → 等比缩放 → 透明 PNG）
// 用法：node scripts/pet-art.js <源图.png> <输出名> [--out <目录>] [--size 宽x高]
//       node scripts/pet-art.js --check          列出 20 只宠物的贴图齐缺与缺图文件名
// 默认输出 assets/bundles/art/pets/<name>.png，320×320。
// 输出名以 pets.json 的 petId 为唯一口径（去掉 pet_ 前缀），拼错直接报错，避免生成永不加载的孤儿 PNG。
const fs = require('fs');
const path = require('path');
const { decodePng, encodePng } = require('./png-codec');
const { keyOut, trim } = require('./pet-art-image');
const { defringe } = require('./pet-art-defringe');
const { toCanvas } = require('./pet-art-resize');

const PET_DIR = path.join(__dirname, '..', 'assets', 'bundles', 'art', 'pets');
const PETS_CONFIG = path.join(__dirname, '..', 'assets', 'bundles', 'cases', 'config', 'pets.json');

/** 规范贴图名 = petId 去掉 pet_ 前缀，与客户端 game/PetAssetManager.ts 的 artName() 同一口径。 */
function canonicalNames() {
  const file = JSON.parse(fs.readFileSync(PETS_CONFIG, 'utf8'));
  return (file.pets || []).map((pet) => String(pet.petId).replace(/^pet_/, ''));
}

/** 归一化：小写、非字母数字转下划线、剥掉 pet_ 前缀，再允许「长品种名 → 规范名」的唯一前缀匹配。 */
function resolveName(raw, names) {
  const key = String(raw)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^pet_|_$/g, '');
  if (names.includes(key)) {
    return key;
  }
  const matched = names.filter((name) => key.startsWith(`${name}_`));
  return matched.length === 1 ? matched[0] : null;
}

function readOptions(argv) {
  const rest = [];
  let outDir = PET_DIR;
  let width = 320;
  let height = 320;
  let check = false;
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
    } else if (token === '--check') {
      check = true;
    } else {
      rest.push(token);
    }
  }
  return { rest, outDir, width, height, check };
}

function reportCheck(outDir) {
  const names = canonicalNames();
  const missing = [];
  let bytes = 0;
  for (const name of names) {
    const target = path.join(outDir, `${name}.png`);
    if (fs.existsSync(target)) {
      const size = fs.statSync(target).size;
      bytes += size;
      console.log(`  已有 ${name}.png  ${(size / 1024).toFixed(1)} KB`);
    } else {
      missing.push(name);
      console.log(`  缺图 ${name}.png`);
    }
  }
  console.log(
    `\n${names.length} 只宠物：贴图 ${names.length - missing.length} 张 / 缺 ${missing.length} 张，` +
      `已入库合计 ${(bytes / 1024).toFixed(1)} KB`,
  );
  if (missing.length) {
    console.log('待补文件名（抠图脚本会按这些名字落到 assets/bundles/art/pets/）：');
    console.log(`  ${missing.map((name) => `${name}.png`).join('、')}`);
    console.log('处理一条示例：node scripts/pet-art.js <源图.png> ' + missing[0]);
  }
  return missing.length;
}

const { rest, outDir, width, height, check } = readOptions(process.argv.slice(2));
if (check) {
  process.exit(reportCheck(outDir) > 0 ? 1 : 0);
}
const [src, rawName] = rest;
if (!src || !rawName) {
  throw new Error('用法：node scripts/pet-art.js <源图.png> <输出名> [--out <目录>] [--size 宽x高]');
}
const names = canonicalNames();
const name = resolveName(rawName, names);
if (!name) {
  throw new Error(
    `未登记的宠物名「${rawName}」。可用输出名：${names.join('、')}\n` +
      '（pet_xxx、xxx_shorthair 这类长写法会自动归一到规范名）',
  );
}
const keyed = keyOut(decodePng(src));
const { img, fixed } = defringe(keyed);
const box = trim(img);
const png = encodePng(width, height, toCanvas(img, box, width, height));
fs.mkdirSync(outDir, { recursive: true });
const target = path.join(outDir, `${name}.png`);
fs.writeFileSync(target, png);
const alias = name === rawName ? '' : `  （${rawName} → ${name}）`;
process.stdout.write(
  `${name}.png  ${box.w}x${box.h} → ${width}x${height}  ${(png.length / 1024).toFixed(1)} KB  去污染 ${fixed}px${alias}\n`,
);
