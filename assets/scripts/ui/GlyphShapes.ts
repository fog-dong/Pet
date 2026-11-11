// STATUS: implemented, W27 P3-UI Graphics 图标形状库（治疗胶囊 / 方案纸卡 / 成就徽章 / 后院槽位共用，禁止第二套画法）
import { Color, Graphics } from 'cc';
import { speaker, speakerOff } from './GlyphShapesAudio';

/** 图标名一律语义化；新增档位必须在这里补一段画法，UI 侧只认名字不认形状。 */
export type GlyphKind =
  | 'medicine'
  | 'bed'
  | 'time'
  | 'trophy'
  | 'paw'
  | 'sprout'
  | 'water'
  | 'lock'
  | 'coin'
  | 'heart'
  | 'sparkle'
  | 'speaker'
  | 'speakerOff';

/** 画法只拿到半宽 r 与已设好线宽/颜色的画布，坐标一律相对 (x, y) 中心。 */
export type GlyphPainter = (g: Graphics, x: number, y: number, r: number, color: Color) => void;

const medicine: GlyphPainter = (g, x, y, r) => {
  g.roundRect(x - 0.72 * r, y - 0.34 * r, 1.44 * r, 0.68 * r, 0.34 * r);
  g.moveTo(x, y - 0.34 * r);
  g.lineTo(x, y + 0.34 * r);
  g.stroke();
};

const bed: GlyphPainter = (g, x, y, r) => {
  g.moveTo(x - 0.7 * r, y - 0.55 * r);
  g.lineTo(x - 0.7 * r, y + 0.42 * r);
  g.lineTo(x + 0.7 * r, y + 0.42 * r);
  g.lineTo(x + 0.7 * r, y - 0.1 * r);
  g.moveTo(x - 0.7 * r, y - 0.1 * r);
  g.lineTo(x + 0.7 * r, y - 0.1 * r);
  g.stroke();
  g.circle(x - 0.38 * r, y - 0.32 * r, 0.16 * r);
  g.stroke();
};

const time: GlyphPainter = (g, x, y, r) => {
  g.circle(x, y, 0.62 * r);
  g.moveTo(x, y);
  g.lineTo(x, y + 0.36 * r);
  g.moveTo(x, y);
  g.lineTo(x + 0.28 * r, y - 0.12 * r);
  g.stroke();
};

/** 奖杯：两只耳是描边，杯身 + 底座是一次填充，先描耳再压杯身。 */
const trophy: GlyphPainter = (g, x, y, r) => {
  g.circle(x - 0.58 * r, y + 0.18 * r, 0.2 * r);
  g.circle(x + 0.58 * r, y + 0.18 * r, 0.2 * r);
  g.stroke();
  g.roundRect(x - 0.4 * r, y - 0.12 * r, 0.8 * r, 0.56 * r, 0.12 * r);
  g.rect(x - 0.06 * r, y - 0.42 * r, 0.12 * r, 0.32 * r);
  g.roundRect(x - 0.32 * r, y - 0.56 * r, 0.64 * r, 0.16 * r, 0.06 * r);
  g.fill();
};

const paw: GlyphPainter = (g, x, y, r) => {
  g.ellipse(x, y - 0.24 * r, 0.36 * r, 0.3 * r);
  g.circle(x - 0.44 * r, y + 0.2 * r, 0.15 * r);
  g.circle(x - 0.15 * r, y + 0.4 * r, 0.15 * r);
  g.circle(x + 0.15 * r, y + 0.4 * r, 0.15 * r);
  g.circle(x + 0.44 * r, y + 0.2 * r, 0.15 * r);
  g.fill();
};

const sprout: GlyphPainter = (g, x, y, r) => {
  g.moveTo(x, y - 0.55 * r);
  g.lineTo(x, y + 0.12 * r);
  g.stroke();
  g.circle(x - 0.28 * r, y + 0.24 * r, 0.24 * r);
  g.circle(x + 0.28 * r, y + 0.32 * r, 0.2 * r);
  g.fill();
};

const water: GlyphPainter = (g, x, y, r) => {
  g.moveTo(x, y + 0.66 * r);
  g.lineTo(x - 0.44 * r, y - 0.06 * r);
  g.lineTo(x + 0.44 * r, y - 0.06 * r);
  g.close();
  g.circle(x, y - 0.12 * r, 0.44 * r);
  g.fill();
};

/** 锁：先描半环，再用实心锁体盖住下半截，省掉 arc 的方向坑。 */
const lock: GlyphPainter = (g, x, y, r) => {
  g.circle(x, y + 0.22 * r, 0.3 * r);
  g.stroke();
  g.roundRect(x - 0.5 * r, y - 0.56 * r, r, 0.66 * r, 0.14 * r);
  g.fill();
};

const coin: GlyphPainter = (g, x, y, r) => {
  g.circle(x, y, 0.62 * r);
  g.moveTo(x - 0.22 * r, y + 0.3 * r);
  g.lineTo(x, y - 0.04 * r);
  g.lineTo(x + 0.22 * r, y + 0.3 * r);
  g.moveTo(x, y - 0.04 * r);
  g.lineTo(x, y - 0.34 * r);
  g.moveTo(x - 0.24 * r, y - 0.12 * r);
  g.lineTo(x + 0.24 * r, y - 0.12 * r);
  g.stroke();
};

/** 心形 = 倒三角 + 两枚圆叶，同色一次填充即为并集，比贝塞尔曲线更稳。 */
const heart: GlyphPainter = (g, x, y, r) => {
  g.moveTo(x, y - 0.55 * r);
  g.lineTo(x - 0.65 * r, y + 0.1 * r);
  g.lineTo(x + 0.65 * r, y + 0.1 * r);
  g.close();
  g.circle(x - 0.33 * r, y + 0.32 * r, 0.34 * r);
  g.circle(x + 0.33 * r, y + 0.32 * r, 0.34 * r);
  g.fill();
};

const sparkle: GlyphPainter = (g, x, y, r) => {
  diamond(g, x, y, r, 0.62, 0.16);
  diamond(g, x, y, r, 0.16, 0.62);
  g.fill();
};

function diamond(g: Graphics, x: number, y: number, r: number, long: number, thin: number): void {
  g.moveTo(x, y + long * r);
  g.lineTo(x + thin * r, y);
  g.lineTo(x, y - long * r);
  g.lineTo(x - thin * r, y);
  g.close();
}

export const GLYPH_SHAPES: Record<GlyphKind, GlyphPainter> = {
  medicine,
  bed,
  time,
  trophy,
  paw,
  sprout,
  water,
  lock,
  coin,
  heart,
  sparkle,
  speaker,
  speakerOff,
};
