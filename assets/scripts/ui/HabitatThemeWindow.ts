// STATUS: implemented, W31 主题窗景：诊所十字 / 樱花 / 海风 / 森林，尺寸全按窗宽高比例算，不引贴图
import { Color, Graphics } from 'cc';
import { HabitatTheme } from '../game/HabitatThemes';
import { tint } from './Tokens';

/** 窗框 + 窗内元素。四套主题各画一种，缩略图与标题带共用，换主题只换配色与元素。 */
export function paintWindow(
  graphics: Graphics,
  cx: number,
  cy: number,
  width: number,
  height: number,
  theme: HabitatTheme,
): void {
  graphics.fillColor = new Color(255, 255, 255, 240);
  graphics.roundRect(cx - width / 2, cy - height / 2, width, height, 8);
  graphics.fill();
  const innerW = width - 10;
  const innerH = height - 10;
  const left = cx - innerW / 2;
  const bottom = cy - innerH / 2;
  graphics.fillColor = tint(theme.sky);
  graphics.rect(left, bottom, innerW, innerH);
  graphics.fill();
  if (theme.id === 'clinic') {
    cross(graphics, cx, cy, innerW, innerH);
  } else if (theme.id === 'sakura') {
    petals(graphics, cx, cy, innerW, innerH, theme);
  } else if (theme.id === 'sea') {
    sea(graphics, cx, cy, left, bottom, innerW, innerH, theme);
  } else {
    forest(graphics, left, bottom, innerW, innerH, theme);
  }
}

function cross(graphics: Graphics, cx: number, cy: number, w: number, h: number): void {
  const arm = Math.min(w, h) * 0.62;
  const thick = Math.max(5, arm * 0.28);
  graphics.fillColor = new Color(255, 255, 255, 235);
  graphics.rect(cx - thick / 2, cy - arm / 2, thick, arm);
  graphics.rect(cx - arm / 2, cy - thick / 2, arm, thick);
  graphics.fill();
}

/** 樱花：一枝斜出 + 五片花瓣，花瓣比背景略深一档。 */
function petals(graphics: Graphics, cx: number, cy: number, w: number, h: number, theme: HabitatTheme): void {
  const r = Math.min(w, h) * 0.09;
  graphics.fillColor = new Color(255, 255, 255, 245);
  const spots: Array<[number, number]> = [[-0.18, 0.2], [0.12, 0.3], [0.26, 0.02], [-0.04, -0.16]];
  spots.forEach(([dx, dy]) => {
    graphics.circle(cx + w * dx, cy + h * dy, r);
  });
  graphics.fill();
  graphics.strokeColor = tint(theme.accent);
  graphics.lineWidth = Math.max(2, r * 0.35);
  graphics.moveTo(cx - w * 0.42, cy - h * 0.3);
  graphics.lineTo(cx + w * 0.05, cy + h * 0.16);
  graphics.lineTo(cx + w * 0.4, cy + h * 0.34);
  graphics.stroke();
}

/** 海风：太阳 + 两道浪线 + 一对海鸥。 */
function sea(
  graphics: Graphics,
  cx: number,
  cy: number,
  left: number,
  bottom: number,
  w: number,
  h: number,
  theme: HabitatTheme,
): void {
  const r = Math.min(w, h) * 0.2;
  graphics.fillColor = tint(theme.accent);
  graphics.circle(cx - w * 0.24, cy + h * 0.18, r);
  graphics.fill();
  graphics.strokeColor = new Color(255, 255, 255, 220);
  graphics.lineWidth = 2.5;
  for (let i = 0; i < 2; i += 1) {
    const y = bottom + h * (0.2 + i * 0.18);
    graphics.moveTo(left + w * 0.1, y);
    graphics.bezierCurveTo(left + w * 0.34, y + 6, left + w * 0.62, y - 6, left + w * 0.9, y);
  }
  graphics.moveTo(cx + w * 0.1, cy + h * 0.32);
  graphics.lineTo(cx + w * 0.16, cy + h * 0.26);
  graphics.lineTo(cx + w * 0.22, cy + h * 0.32);
  graphics.stroke();
}

/** 森林：三棵树 + 树干，树冠用同色深浅拉开层次。 */
function forest(graphics: Graphics, left: number, bottom: number, w: number, h: number, theme: HabitatTheme): void {
  const trees: Array<[number, number]> = [[0.24, 0.42], [0.52, 0.58], [0.78, 0.4]];
  trees.forEach(([dx, scale], index) => {
    const cx = left + w * dx;
    const base = bottom + h * 0.16;
    const tall = h * 0.5 * scale;
    graphics.fillColor = tint(theme.accent, index === 1 ? 255 : 200);
    graphics.moveTo(cx, base + tall);
    graphics.lineTo(cx - tall * 0.42, base);
    graphics.lineTo(cx + tall * 0.42, base);
    graphics.close();
    graphics.fill();
    graphics.fillColor = new Color(150, 122, 92, 220);
    graphics.rect(cx - 2, base - h * 0.08, 4, h * 0.08);
    graphics.fill();
  });
}
