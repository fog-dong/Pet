// STATUS: implemented, W16 立绘抠图算法（洋红底漫水去背 → 反预乘边缘 → 裁白边）
/** 与底色距离 ≤ LO 视为纯背景，≥ HI 视为纯前景，中间按比例给半透明边缘，避免洋红描边。 */
const BG_LO = 45;
const BG_HI = 140;

function sampleBg(width, height, data) {
  const picks = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  const sum = [0, 0, 0];
  picks.forEach(([x, y]) => {
    const o = (y * width + x) * 4;
    sum[0] += data[o];
    sum[1] += data[o + 1];
    sum[2] += data[o + 2];
  });
  return [sum[0] / 4, sum[1] / 4, sum[2] / 4];
}

function dist2(data, i, bg) {
  const o = i * 4;
  const dr = data[o] - bg[0];
  const dg = data[o + 1] - bg[1];
  const db = data[o + 2] - bg[2];
  return dr * dr + dg * dg + db * db;
}

/** 四邻域漫水：只清理与画布边缘连通的底色，主体内部同色区域不会被误伤。 */
function keyOut(img) {
  const { width, height, data } = img;
  const bg = sampleBg(width, height, data);
  const isBg = new Uint8Array(width * height);
  const stack = [];
  const seedIndex = (i) => {
    if (isBg[i]) return;
    if (dist2(data, i, bg) <= BG_HI * BG_HI) {
      isBg[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < width; x++) {
    seedIndex(x);
    seedIndex((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    seedIndex(y * width);
    seedIndex(y * width + width - 1);
  }
  // 耳朵、尾巴围出的封闭底色块与边缘不连通，按「纯底色」直接补种，避免残留洋红补丁。
  for (let i = 0; i < width * height; i++) {
    if (dist2(data, i, bg) <= 20 * 20) {
      seedIndex(i);
    }
  }
  while (stack.length) {
    const i = stack.pop();
    const x = i % width;
    const y = (i - x) / width;
    const visit = (nx, ny) => {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
      const j = ny * width + nx;
      if (isBg[j]) return;
      isBg[j] = 1;
      if (dist2(data, j, bg) <= BG_HI * BG_HI) stack.push(j);
    };
    visit(x - 1, y);
    visit(x + 1, y);
    visit(x, y - 1);
    visit(x, y + 1);
  }
  const span = BG_HI - BG_LO;
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    if (!isBg[i]) {
      data[o + 3] = 255;
      continue;
    }
    const d = Math.sqrt(dist2(data, i, bg));
    const a = Math.max(0, Math.min(1, (d - BG_LO) / span));
    data[o + 3] = Math.round(a * 255);
    // 边缘像素原本与洋红混合过，按 alpha 反预乘把它还原成主体色。
    if (a > 0.06) {
      for (let c = 0; c < 3; c++) {
        data[o + c] = Math.max(0, Math.min(255, Math.round((data[o + c] - bg[c] * (1 - a)) / a)));
      }
    }
  }
  return img;
}

function trim(img) {
  const { width, height, data } = img;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0) {
    throw new Error('抠完背景后没有剩下不透明像素');
  }
  const pad = 2;
  left = Math.max(0, left - pad);
  top = Math.max(0, top - pad);
  right = Math.min(width - 1, right + pad);
  bottom = Math.min(height - 1, bottom + pad);
  return { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}

module.exports = { keyOut, trim };
