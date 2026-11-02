// STATUS: implemented, W20-5 立绘边缘去污染（配合 pet-art-image 的洋红去背）
/**
 * 洋红底生成图在主体轮廓处有两类残留：
 * 1) 半透明带——keyOut 的距离斜坡在 d=BG_HI 处就把 alpha 抬到 1，而真实覆盖率只有
 *    d/255，反预乘除以偏大的 a，颜色里仍留洋红；
 * 2) 贴边的「实心」像素——源图本身就混了底色，但到洋红的距离已超 BG_HI，被 keyOut
 *    判为纯前景，颜色完全没还原（白毛个体上就是肉眼可见的粉圈）。
 * 这里把贴边若干像素内、带洋红特征的像素，用邻域内干净的不透明像素平均色覆盖：
 * 只改颜色，不动 alpha 与轮廓。自然粉（耳内、舌头、鼻子）r 明显高于 b，被
 * CAST_BALANCE 排除，不会被误洗白。
 */
const CAST_MIN = 12;
const CAST_BALANCE = 22;
const RIM_DEPTH = 8;
const BAND_ALPHA = 250;
const RINGS = [3, 6, 10, 16];

function isCast(r, g, b) {
  return r - g >= CAST_MIN && b - g >= CAST_MIN && Math.abs(r - b) <= CAST_BALANCE;
}

/** 从所有半透明/透明像素向内做广度优先，得到每个像素到轮廓的距离（层数）。 */
function rimDepth(img) {
  const { width, height, data } = img;
  const total = width * height;
  const depth = new Int16Array(total).fill(-1);
  const queue = [];
  for (let i = 0; i < total; i++) {
    if (data[i * 4 + 3] < BAND_ALPHA) {
      depth[i] = 0;
      queue.push(i);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    if (depth[i] >= RIM_DEPTH) continue;
    const x = i % width;
    const y = (i - x) / width;
    const push = (nx, ny) => {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
      const j = ny * width + nx;
      if (depth[j] !== -1) return;
      depth[j] = depth[i] + 1;
      queue.push(j);
    };
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }
  return depth;
}

/** 在由小到大的环里找第一批「完全不透明且不带洋红」的邻居，取平均色。 */
function cleanColor(img, x, y, radius) {
  const { width, height, data } = img;
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let n = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    const yy = y + dy;
    if (yy < 0 || yy >= height) continue;
    for (let dx = -radius; dx <= radius; dx++) {
      const xx = x + dx;
      if (xx < 0 || xx >= width) continue;
      const j = (yy * width + xx) * 4;
      if (data[j + 3] < BAND_ALPHA) continue;
      if (isCast(data[j], data[j + 1], data[j + 2])) continue;
      sr += data[j];
      sg += data[j + 1];
      sb += data[j + 2];
      n += 1;
    }
  }
  return n ? [Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)] : null;
}

function defringe(img) {
  const { width, height, data } = img;
  const depth = rimDepth(img);
  let fixed = 0;
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    if (depth[i] < 0 || depth[i] > RIM_DEPTH) continue;
    if (data[o + 3] === 0) continue;
    if (!isCast(data[o], data[o + 1], data[o + 2])) continue;
    const x = i % width;
    const y = (i - x) / width;
    for (const radius of RINGS) {
      const rgb = cleanColor(img, x, y, radius);
      if (!rgb) continue;
      data[o] = rgb[0];
      data[o + 1] = rgb[1];
      data[o + 2] = rgb[2];
      fixed += 1;
      break;
    }
  }
  return { img, fixed };
}

module.exports = { defringe, isCast, RIM_DEPTH };
