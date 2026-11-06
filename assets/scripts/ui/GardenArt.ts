// STATUS: implemented, W27 P3-UI 后院种植槽手绘（木框 + 内土垄沟 + 四档分层幼苗，全部 Graphics，不新增贴图）
import { Color, Graphics, Node } from 'cc';
import { drawGlyph } from './GlyphKit';
import { COLORS, tint } from './Tokens';

export type PlotVisual = 'locked' | 'empty' | 'growing' | 'ready';
export const SOIL_W = 150;
export const SOIL_H = 66;

const WOOD = '#B5845A';
const WOOD_EDGE = '#8A5E3A';
const WOOD_LIGHT = '#D2A578';
const WOOD_GRAY = '#BCAE9C';
const WOOD_GRAY_EDGE = '#94887A';
const SOIL = '#8B6B4E';
const SOIL_WET = '#A07C5B';
const FURROW = '#6E5238';
const SOIL_LOCKED = '#A3958A';
const STEM = '#6F8F5B';
const LEAF = '#8AB17A';

/** 每一档幼苗的茎高：0 子叶芽 / 1 双叶 / 2 四叶 / 3 抽穗（成熟）。 */
const STEM_H = [13, 21, 29, 35];
/** 苗从内土里冒出来，基点压在地面下沿，长成后刚好顶到木框上沿。 */
const BASE_Y = -13;
const RAIL = 9;

/**
 * 种植槽 = 外木框（厚边 + 顶光 + 板缝）+ 内土（湿土带 + 三道垄沟）+ 苗。
 * progress 只决定苗画到第几层，成熟态由调用方通过 visual 给出，避免这里再读时间。
 */
export function paintSoil(node: Node, visual: PlotVisual, cropTint: string, progress = 0): Graphics {
  const g = node.getComponent(Graphics) ?? node.addComponent(Graphics);
  g.clear();
  const locked = visual === 'locked';
  paintFrame(g, locked);
  paintBed(g, locked);
  if (locked) {
    drawGlyph(g, 'lock', 0, 1, 26, tint(WOOD_GRAY_EDGE));
    return g;
  }
  if (visual === 'empty') {
    g.fillColor = tint(SOIL_WET, 150);
    [-28, 0, 28].forEach((x) => g.circle(x, -2, 5));
    g.fill();
    return g;
  }
  const stage = visual === 'ready' ? 3 : Math.min(2, Math.floor(Math.max(0, progress) * 3));
  paintSprout(g, cropTint, stage, visual === 'ready');
  return g;
}

/** 木框：先画下沉一档的暗色侧壁，再画受光的正面，最后点两道板缝，槽子才有厚度。 */
function paintFrame(g: Graphics, locked: boolean): void {
  const edge = locked ? WOOD_GRAY_EDGE : WOOD_EDGE;
  const face = locked ? WOOD_GRAY : WOOD;
  g.fillColor = tint(edge);
  g.roundRect(-SOIL_W / 2, -SOIL_H / 2 - 5, SOIL_W, SOIL_H, 14);
  g.fill();
  g.fillColor = tint(face);
  g.roundRect(-SOIL_W / 2, -SOIL_H / 2, SOIL_W, SOIL_H, 14);
  g.fill();
  g.fillColor = tint(locked ? '#CDBFAE' : WOOD_LIGHT, 175);
  g.roundRect(-SOIL_W / 2 + 7, SOIL_H / 2 - 8, SOIL_W - 14, 4, 2);
  g.fill();
  g.fillColor = tint(edge, 130);
  [-28, 28].forEach((x) => g.rect(x - 1.5, SOIL_H / 2 - 9, 3, 9));
  g.fill();
}

/** 内土：一圈暗边表示土落在框内，靠上沿一条湿土带，再压三道垄沟。 */
function paintBed(g: Graphics, locked: boolean): void {
  g.fillColor = tint(locked ? SOIL_LOCKED : FURROW, 120);
  g.roundRect(-SOIL_W / 2 + RAIL - 2, -SOIL_H / 2 + RAIL - 4, SOIL_W - (RAIL - 2) * 2, SOIL_H - (RAIL - 2) * 2, 9);
  g.fill();
  g.fillColor = tint(locked ? SOIL_LOCKED : SOIL);
  g.roundRect(-SOIL_W / 2 + RAIL, -SOIL_H / 2 + RAIL, SOIL_W - RAIL * 2, SOIL_H - RAIL * 2, 8);
  g.fill();
  if (locked) {
    return;
  }
  g.fillColor = tint(SOIL_WET, 120);
  g.roundRect(-SOIL_W / 2 + RAIL + 4, 11, SOIL_W - (RAIL + 4) * 2, 6, 3);
  g.fill();
  g.fillColor = tint(FURROW, 145);
  [4, -4, -12].forEach((y) => g.rect(-52, y - 1.2, 104, 2.4));
  g.fill();
}

/** 分层生长：每长一档多一层叶，最后一档才抽穗；成熟加金环与三点金粉。 */
function paintSprout(g: Graphics, cropTint: string, stage: number, ready: boolean): void {
  if (ready) {
    g.fillColor = new Color(COLORS.gold.r, COLORS.gold.g, COLORS.gold.b, 58);
    g.circle(0, 6, 27);
    g.fill();
  }
  const h = STEM_H[Math.min(3, Math.max(0, stage))];
  g.fillColor = tint(STEM);
  g.roundRect(-2.5, BASE_Y, 5, h, 2.5);
  g.fill();
  g.fillColor = tint(stage === 0 ? cropTint : LEAF);
  g.ellipse(-10, BASE_Y + h * 0.5, 9, 5.5);
  g.ellipse(10, BASE_Y + h * 0.5, 9, 5.5);
  g.fill();
  if (stage >= 1) {
    g.fillColor = tint(LEAF, 225);
    g.ellipse(-8, BASE_Y + h * 0.78, 7.5, 4.5);
    g.ellipse(8, BASE_Y + h * 0.78, 7.5, 4.5);
    g.fill();
  }
  if (stage >= 2) {
    g.fillColor = tint(cropTint);
    g.circle(0, BASE_Y + h + 4, stage === 3 ? 7 : 5);
    g.fill();
  }
  if (ready) {
    g.fillColor = COLORS.gold;
    g.circle(-21, 24, 3);
    g.circle(23, 20, 2.5);
    g.circle(15, 33, 2);
    g.fill();
  }
}
