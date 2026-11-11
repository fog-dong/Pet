// STATUS: implemented, W33 音频类图标（音箱 / 静音斜杠），由 GlyphShapes 汇总进同一张表
import type { Graphics } from 'cc';
import type { GlyphPainter } from './GlyphShapes';

/** 音箱：箱体一次填充，右侧再压两道声波弧（大厅音乐开关）。 */
export const speaker: GlyphPainter = (g, x, y, r) => {
  speakerBody(g, x, y, r);
  g.arc(x + 0.14 * r, y, 0.3 * r, -0.85, 0.85, true);
  g.stroke();
  g.arc(x + 0.14 * r, y, 0.56 * r, -0.8, 0.8, true);
  g.stroke();
};

/** 静音：箱体保留，声波换成一道右斜杠，一眼能读出「关了」。 */
export const speakerOff: GlyphPainter = (g, x, y, r) => {
  speakerBody(g, x, y, r);
  g.moveTo(x + 0.52 * r, y + 0.5 * r);
  g.lineTo(x + 0.04 * r, y - 0.5 * r);
  g.stroke();
};

function speakerBody(g: Graphics, x: number, y: number, r: number): void {
  g.moveTo(x - 0.62 * r, y + 0.22 * r);
  g.lineTo(x - 0.26 * r, y + 0.22 * r);
  g.lineTo(x + 0.02 * r, y + 0.5 * r);
  g.lineTo(x + 0.02 * r, y - 0.5 * r);
  g.lineTo(x - 0.26 * r, y - 0.22 * r);
  g.lineTo(x - 0.62 * r, y - 0.22 * r);
  g.close();
  g.fill();
}
