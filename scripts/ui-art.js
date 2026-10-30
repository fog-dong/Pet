// STATUS: implemented, W16 过程化 UI 九宫格贴图（圆角/高光/木纹/软投影，无 AI、无外部依赖）
// 输出白色中性底，运行时用 sprite.color 染色；胶囊用 Graphics 现画（任意高度都不糊），不生成 pill 贴图。
// 用法：node scripts/ui-art.js
const fs = require('fs');
const path = require('path');
const { encodePng } = require('./png-codec');

const OUT = path.join(__dirname, '..', 'assets', 'bundles', 'ui');
const SIZE = 128;

function canvas(w = SIZE, h = SIZE) {
  return { w, h, data: Buffer.alloc(w * h * 4) };
}

function blend(img, x, y, r, g, b, a) {
  if (a <= 0 || x < 0 || y < 0 || x >= img.w || y >= img.h) {
    return;
  }
  const i = (y * img.w + x) * 4;
  const src = Math.min(1, a);
  const dst = img.data[i + 3] / 255;
  const out = src + dst * (1 - src);
  if (out <= 0) {
    return;
  }
  img.data[i] = Math.round((r * src + img.data[i] * dst * (1 - src)) / out);
  img.data[i + 1] = Math.round((g * src + img.data[i + 1] * dst * (1 - src)) / out);
  img.data[i + 2] = Math.round((b * src + img.data[i + 2] * dst * (1 - src)) / out);
  img.data[i + 3] = Math.round(out * 255);
}

/** 圆角矩形的有符号距离：矩形 (cx,cy) 中心、半宽 hw/2、半高 hh/2。 */
function sdRound(cx, cy, hw, hh, r, x, y) {
  const qx = Math.abs(x - cx) - (hw - r);
  const qy = Math.abs(y - cy) - (hh - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.sqrt(ax * ax + ay * ay) + Math.min(Math.max(qx, qy), 0) - r;
}

function fillRound(img, inset, radius, paint) {
  const hw = (img.w - inset * 2) / 2;
  const hh = (img.h - inset * 2) / 2;
  const cx = img.w / 2;
  const cy = img.h / 2;
  const top = cy - hh;
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const d = sdRound(cx, cy, hw, hh, radius, x + 0.5, y + 0.5);
      const cover = Math.min(1, Math.max(0, 0.5 - d));
      if (cover <= 0) {
        continue;
      }
      const color = paint(x + 0.5, y + 0.5, top, hh * 2);
      blend(img, x, y, color[0], color[1], color[2], color[3] * cover);
    }
  }
}

/** 竖向渐变 + 顶部 2px 高光 + 1px 内描边。 */
function glossy(topColor, bottomColor, inset, radius) {
  return (x, y, top, h) => {
    const t = Math.min(1, Math.max(0, (y - top) / h));
    const r = Math.round(topColor[0] + (bottomColor[0] - topColor[0]) * t);
    const g = Math.round(topColor[1] + (bottomColor[1] - topColor[1]) * t);
    const b = Math.round(topColor[2] + (bottomColor[2] - topColor[2]) * t);
    const edge = y - top < 2 ? 0.35 : y - top < 3 ? 0.14 : 0;
    return [Math.min(255, r + 255 * edge), Math.min(255, g + 255 * edge), Math.min(255, b + 255 * edge), 255];
  };
}

/** 程序化木纹：横向纹理 + 确定性噪点，不用随机数，保证每次生成一致。 */
function woodPixels() {
  const hash = (x, y) => {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return n - Math.floor(n);
  };
  return (x, y, top, h) => {
    const band = Math.sin(y * 0.9 + Math.sin(x * 0.05) * 1.6) * 0.5 + 0.5;
    const grain = hash(x, Math.floor(y / 2)) * 14;
    const base = 214 + band * 18 - grain;
    return [Math.min(255, base + 14), Math.min(255, base - 2), Math.min(255, base - 30), 255];
  };
}

function save(name, img) {
  fs.mkdirSync(OUT, { recursive: true });
  const png = encodePng(img.w, img.h, img.data);
  fs.writeFileSync(path.join(OUT, `${name}.png`), png);
  process.stdout.write(`${name}.png  ${img.w}x${img.h}  ${(png.length / 1024).toFixed(1)} KB\n`);
}

// 按钮底：白色中性，96% 不透明，便于 sprite.color 直接染成主色/次色/禁用色。
const btn = canvas();
fillRound(btn, 6, 24, glossy([255, 255, 255], [238, 238, 238], 6, 24));
save('ui_btn_neutral', btn);

// 卡片纸面：暖白 + 顶部高光，圆角 16。
const paper = canvas();
fillRound(paper, 4, 16, glossy([255, 255, 255], [246, 243, 238], 4, 16));
save('ui_panel_paper', paper);

// 木纹条：标题栏 / 前台桌同款材质，直接原色使用，不做 tint。
const wood = canvas();
fillRound(wood, 4, 16, woodPixels(4, 16));
save('ui_panel_wood', wood);

// 软投影：黑 22%，边缘 10px 渐隐，单独一层贴在被投影物下方。
const shadow = canvas();
fillRound(shadow, 14, 26, () => [0, 0, 0, 56]);
save('ui_shadow_round', shadow);
