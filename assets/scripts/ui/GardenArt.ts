// STATUS: implemented, W25 P2-C 后院地块手绘（土坑/垄沟/苗/成熟光圈，全部 Graphics，不新增贴图）
import { Color, Graphics, Node } from 'cc';
import { COLORS, tint } from './Tokens';

export type PlotVisual = 'locked' | 'empty' | 'growing' | 'ready';
export const SOIL_W = 150;
export const SOIL_H = 66;

const SOIL = '#8B6B4E';
const SOIL_DARK = '#6E5238';
const FURROW = '#75583F';
const LOCKED = '#B9AA97';
const STEM = '#6F8F5B';

/** 土坑先铺底，再画三道垄沟；有苗时叠苗，成熟再加一圈金环。 */
export function paintSoil(node: Node, visual: PlotVisual, cropTint: string): Graphics {
  const g = node.getComponent(Graphics) ?? node.addComponent(Graphics);
  g.clear();
  g.fillColor = tint(visual === 'locked' ? LOCKED : SOIL);
  g.roundRect(-SOIL_W / 2, -SOIL_H / 2, SOIL_W, SOIL_H, 16);
  g.fill();
  if (visual === 'locked') {
    return g;
  }
  g.fillColor = tint(SOIL_DARK, 70);
  g.roundRect(-SOIL_W / 2 + 6, -SOIL_H / 2 + 6, SOIL_W - 12, 16, 8);
  g.fill();
  g.fillColor = tint(FURROW);
  [-16, 0, 16].forEach((row) => {
    g.rect(-54, row - 1, 108, 3);
  });
  g.fill();
  if (visual === 'growing' || visual === 'ready') {
    paintPlant(g, cropTint, visual === 'ready');
  }
  return g;
}

function paintPlant(g: Graphics, cropTint: string, ready: boolean): void {
  if (ready) {
    g.fillColor = new Color(COLORS.gold.r, COLORS.gold.g, COLORS.gold.b, 62);
    g.circle(0, 4, 40);
    g.fill();
  }
  g.fillColor = tint(STEM);
  g.rect(-2, -14, 4, 34);
  g.fill();
  g.fillColor = tint(cropTint);
  g.ellipse(-12, 18, 13, 8);
  g.ellipse(12, 12, 13, 8);
  g.fill();
  if (ready) {
    g.fillColor = COLORS.gold;
    g.circle(-24, 30, 3);
    g.circle(25, 27, 2.5);
    g.circle(18, 40, 2);
    g.fill();
  }
}
