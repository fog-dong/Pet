// STATUS: implemented, W16 立绘缩放（预乘 alpha 区域平均，等比铺进 320 方图）
const CANVAS = 320;
const CONTENT = 300;

/** 区域平均缩放到 320 方图，预乘 alpha 采样避免透明边缘发灰。 */
function toSquare(img, box) {
  const src = img.data;
  const sw = img.width;
  const scale = CONTENT / Math.max(box.w, box.h);
  const dw = Math.max(1, Math.round(box.w * scale));
  const dh = Math.max(1, Math.round(box.h * scale));
  const ox = Math.round((CANVAS - dw) / 2);
  const oy = Math.round((CANVAS - dh) / 2);
  const out = Buffer.alloc(CANVAS * CANVAS * 4);
  for (let y = 0; y < dh; y++) {
    const y0 = box.y + Math.floor((y * box.h) / dh);
    const y1 = Math.max(y0 + 1, box.y + Math.floor(((y + 1) * box.h) / dh));
    for (let x = 0; x < dw; x++) {
      const x0 = box.x + Math.floor((x * box.w) / dw);
      const x1 = Math.max(x0 + 1, box.x + Math.floor(((x + 1) * box.w) / dw));
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let sa = 0;
      let n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const o = (sy * sw + sx) * 4;
          const a = src[o + 3] / 255;
          sr += src[o] * a;
          sg += src[o + 1] * a;
          sb += src[o + 2] * a;
          sa += a;
          n += 1;
        }
      }
      if (!n || sa <= 0) continue;
      const o = ((oy + y) * CANVAS + ox + x) * 4;
      out[o] = Math.min(255, Math.round(sr / sa));
      out[o + 1] = Math.min(255, Math.round(sg / sa));
      out[o + 2] = Math.min(255, Math.round(sb / sa));
      out[o + 3] = Math.min(255, Math.round((sa / n) * 255));
    }
  }
  return out;
}

module.exports = { CANVAS, toSquare };
