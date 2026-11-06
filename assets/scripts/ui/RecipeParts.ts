// STATUS: implemented, W27 P3-UI 合成卡片的纯绘制零件（内衬板 / 方向箭头 / 产物图标），供 GardenRecipes 排版复用
import { Color, Graphics, Node } from 'cc';
import { GlyphKind } from './GlyphKit';
import { createBox, paintRound } from './PanelKit';
import { COLORS } from './Tokens';

/** 配方行几何：整行宽 590，材料板与产物板各占一侧，中间留给箭头。 */
export const ROW_W = 590;
export const ROW_H = 120;
export const ROW_GAP = 12;
export const ROW_TOP = 132;
export const MATS_W = 200;
export const MATS_X = -190;
export const OUT_W = 210;
export const OUT_X = 60;

const PANEL_H = 96;

/** 材料 / 产物两块内衬板：与行卡同高但上下各留 6px，做出「卡片里再嵌一层纸」的层次。 */
export function addRecipePanel(card: Node, name: string, x: number, width: number, color: Color): Node {
  const node = createBox(card, `GardenRecipe${name}_${card.name}`, 0, width, PANEL_H, x);
  paintRound(node, width, PANEL_H, 12, color);
  return node;
}

/** 材料 → 产物的方向指示：一条横线加一个箭头，纯描边，不引贴图。 */
export function addArrow(parent: Node, x: number): void {
  const node = createBox(parent, `CraftArrow_${parent.name}`, 0, 40, 24, x);
  const g = node.addComponent(Graphics);
  g.lineWidth = 4;
  g.strokeColor = COLORS.skirt;
  g.moveTo(-16, 0);
  g.lineTo(10, 0);
  g.moveTo(1, 8);
  g.lineTo(12, 0);
  g.lineTo(1, -8);
  g.stroke();
}

/** 产物图标按条目 id 取语义：粮给爪印、外用药给胶囊，其余走闪光。 */
export function productGlyph(itemId: string): GlyphKind {
  if (itemId.includes('food')) {
    return 'paw';
  }
  if (itemId.includes('balm') || itemId.includes('drops')) {
    return 'medicine';
  }
  return 'sparkle';
}
