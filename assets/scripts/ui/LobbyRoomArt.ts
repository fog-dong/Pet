// STATUS: implemented, W32-1 大厅房间层画法：窗（天空 + 窗棂 + 窗台）、挂钟表盘、暖光柱，全部 Graphics 现画
// 颜色取木色与奶油纸，四套装修主题下都不打架；不新增图片资源，也就不必再补 .meta 与分包体积。
import { Color, Graphics, Node } from 'cc';
import { tint } from './Tokens';

export const ROOM_FRAME = '#C9A67F';
export const ROOM_FRAME_DARK = '#B08A62';
const SKY = '#DCEEF7';
const SKY_LOW = '#EAF4E8';
const SUN = '#FFE9B8';
const FACE = '#FFFCF4';
const RIM = '#D8B98D';
const TICK = '#8A7868';

/** 窗：木框 + 玻璃天空 + 十字窗棂 + 窗台。node 尺寸即外框尺寸。 */
export function paintWindow(node: Node, w: number, h: number): void {
  const g = node.addComponent(Graphics);
  const pad = Math.max(8, w * 0.06);
  g.fillColor = tint(ROOM_FRAME);
  g.roundRect(-w / 2, -h / 2, w, h, 14);
  g.fill();
  g.fillColor = tint(SKY);
  g.rect(-w / 2 + pad, -h / 2 + pad, w - pad * 2, h - pad * 2);
  g.fill();
  g.fillColor = tint(SKY_LOW);
  g.rect(-w / 2 + pad, -h / 2 + pad, w - pad * 2, (h - pad * 2) * 0.32);
  g.fill();
  g.fillColor = tint(SUN);
  g.circle(w * 0.2, h * 0.16, Math.min(w, h) * 0.09);
  g.fill();
  g.fillColor = tint(ROOM_FRAME);
  g.rect(-3, -h / 2 + pad, 6, h - pad * 2);
  g.rect(-w / 2 + pad, -1, w - pad * 2, 5);
  g.fill();
  g.fillColor = tint(ROOM_FRAME_DARK);
  g.roundRect(-w / 2 - 8, -h / 2 - 7, w + 16, 11, 5);
  g.fill();
}

/** 表盘：奶油面 + 木色圈 + 12 根刻度（整点是长针）。指针由调用方另建节点转动。 */
export function paintClockFace(node: Node, r: number): void {
  const g = node.addComponent(Graphics);
  g.fillColor = tint(FACE);
  g.circle(0, 0, r);
  g.fill();
  g.lineWidth = Math.max(4, r * 0.14);
  g.strokeColor = tint(RIM);
  g.circle(0, 0, r);
  g.stroke();
  g.lineWidth = 2.4;
  g.strokeColor = tint(TICK);
  for (let i = 0; i < 12; i += 1) {
    const a = (i * Math.PI) / 6;
    const outer = r * 0.84;
    const inner = i % 3 === 0 ? r * 0.58 : r * 0.7;
    g.moveTo(Math.sin(a) * inner, Math.cos(a) * inner);
    g.lineTo(Math.sin(a) * outer, Math.cos(a) * outer);
  }
  g.stroke();
  g.fillColor = tint(TICK);
  g.circle(0, 0, Math.max(3, r * 0.1));
  g.fill();
}

/** 一根指针：原点在轴心，朝 12 点方向画；旋转交给 node.angle。 */
export function paintHand(node: Node, length: number, width: number, alpha = 255): void {
  const g = node.addComponent(Graphics);
  g.lineWidth = width;
  g.strokeColor = tint(TICK, alpha);
  g.moveTo(0, 0);
  g.lineTo(0, length);
  g.stroke();
}

/** 暖光柱：从窗右侧斜落到台面，顶宽底窄；透明度由外层 UIOpacity 呼吸。 */
export function paintBeam(node: Node, w: number, h: number): void {
  const g = node.addComponent(Graphics);
  g.fillColor = new Color(255, 246, 220, 255);
  g.moveTo(0, 0);
  g.lineTo(w, -h * 0.06);
  g.lineTo(w * 0.66, -h);
  g.lineTo(w * 0.12, -h);
  g.close();
  g.fill();
}
