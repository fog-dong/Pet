// STATUS: implemented, W16 素材缩放（预乘 alpha 区域平均，等比铺进指定画布）
const CANVAS = 320;

/** 区域平均缩放到指定画布，等比适配并居中；padRatio 为四周留白占比。 */
function toCanvas(img, box, width = CANVAS, height = CANVAS, padRatio = 0.03) {
  const src = img.data;
  const sw = img.width;
  const scale = Math.min((width * (1 - padRatio * 2)) / box.w, (height * (1 - padRatio * 2)) / box.h);
  const dw = Math.max(1, Math.round(box.w * scale));
  const dh = Math.max(1, Math.round(box.h * scale));
  const ox = Math.round((width - dw) / 2);
  const oy = Math.round((height - dh) / 2);
  const out = Buffer.alloc(width * height * 4);
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
      const o = ((oy + y) * width + ox + x) * 4;
      out[o] = Math.min(255, Math.round(sr / sa));
      out[o + 1] = Math.min(255, Math.round(sg / sa));
      out[o + 2] = Math.min(255, Math.round(sb / sa));
      out[o + 3] = Math.min(255, Math.round((sa / n) * 255));
    }
  }
  return out;
}

module.exports = { CANVAS, toCanvas };
