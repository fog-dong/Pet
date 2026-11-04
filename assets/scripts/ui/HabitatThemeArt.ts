// STATUS: implemented, W25 P1-C 小屋主题窗景（Graphics 现画；不新增贴图，换主题只换配色与窗内元素）
// 三处落笔：标题带（门牌窗景）、左右墙饰条、装修弹窗缩略图；卡片底色由 HabitatPanel 取主题色直填。
import { Color, Graphics, Node, UITransform } from 'cc';
import { HabitatTheme } from '../game/HabitatThemes';
import { tint } from './Tokens';

const BAND_Y = 352;
const BAND_H = 72;
const BAND_INSET = 48;
const STRIP_W = 22;
const STRIP_H = 460;
const STRIP_Y = -10;

/** 面板主题层：标题带 + 左右墙饰条；必须在 addCard 之后立刻建，才排在 Sliced 底图之上。
 *  不能 setSiblingIndex(0)：九宫格底图会异步插到 index 0，主题层会被它盖住（装修重建后才会暴露）。 */
export function paintRoomHeader(panel: Node, panelWidth: number, theme: HabitatTheme): void {
  const width = Math.max(240, panelWidth - BAND_INSET);
  const node = new Node('HabitatRoomHeader');
  node.parent = panel;
  node.setPosition(0, 0, 0);
  node.addComponent(UITransform).setContentSize(panelWidth, 780);
  const graphics = node.addComponent(Graphics);
  paintStrips(graphics, panelWidth, theme);
  graphics.fillColor = tint(theme.wall);
  graphics.roundRect(-width / 2, BAND_Y - BAND_H / 2, width, BAND_H, 12);
  graphics.fill();
  drawWindow(graphics, -width / 2 + 60, BAND_Y, 92, 44, theme);
}

/** 装修弹窗里的缩略图：与标题带同一套窗景，只是按缩略图尺寸铺满。 */
export function paintThemePreview(
  parent: Node,
  theme: HabitatTheme,
  x: number,
  y: number,
  width: number,
  height: number,
): Node {
  const node = new Node(`ThemePreview_${theme.id}`);
  node.parent = parent;
  node.setPosition(x, y, 0);
  node.addComponent(UITransform).setContentSize(width, height);
  const graphics = node.addComponent(Graphics);
  graphics.fillColor = tint(theme.panel);
  graphics.roundRect(-width / 2, -height / 2, width, height, 10);
  graphics.fill();
  graphics.fillColor = tint(theme.floor);
  graphics.roundRect(-width / 2 + 5, -height / 2 + 4, width - 10, height * 0.24, 6);
  graphics.fill();
  drawWindow(graphics, 0, height * 0.12, width * 0.62, height * 0.54, theme);
  return node;
}

/** 左右两条竖向墙饰，让主题色在卡片两侧露出来；三段小圆点当壁纸纹样。 */
function paintStrips(graphics: Graphics, panelWidth: number, theme: HabitatTheme): void {
  const x = panelWidth / 2 - STRIP_W / 2 - 8;
  graphics.fillColor = tint(theme.wall, 210);
  graphics.roundRect(-x - STRIP_W / 2, STRIP_Y - STRIP_H / 2, STRIP_W, STRIP_H, 11);
  graphics.fill();
  graphics.roundRect(x - STRIP_W / 2, STRIP_Y - STRIP_H / 2, STRIP_W, STRIP_H, 11);
  graphics.fill();
  graphics.fillColor = tint(theme.accent, 170);
  for (let i = 0; i < 3; i += 1) {
    const dotY = 140 - i * 90;
    graphics.circle(-x, dotY, 5);
    graphics.circle(x, dotY, 5);
  }
  graphics.fill();
}

/** 窗框 + 窗内元素：诊所十字 / 卧室月夜 / 阳台太阳与栏杆。尺寸全部按窗宽高比例算。 */
function drawWindow(
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
    const arm = Math.min(innerW, innerH) * 0.62;
    const thick = Math.max(5, arm * 0.28);
    graphics.fillColor = new Color(255, 255, 255, 235);
    graphics.rect(cx - thick / 2, cy - arm / 2, thick, arm);
    graphics.rect(cx - arm / 2, cy - thick / 2, arm, thick);
    graphics.fill();
  } else if (theme.id === 'bedroom') {
    const r = Math.min(innerW, innerH) * 0.26;
    graphics.fillColor = new Color(255, 246, 214, 255);
    graphics.circle(cx - innerW * 0.18, cy + innerH * 0.14, r);
    graphics.fill();
    graphics.fillColor = new Color(255, 246, 214, 210);
    graphics.circle(cx + innerW * 0.24, cy + innerH * 0.2, 2.4);
    graphics.circle(cx + innerW * 0.12, cy - innerH * 0.18, 2);
    graphics.circle(cx + innerW * 0.34, cy - innerH * 0.02, 2);
    graphics.fill();
  } else {
    const r = Math.min(innerW, innerH) * 0.24;
    graphics.fillColor = tint(theme.accent);
    graphics.circle(cx - innerW * 0.24, cy + innerH * 0.18, r);
    graphics.fill();
    graphics.strokeColor = new Color(255, 255, 255, 210);
    graphics.lineWidth = 3;
    const railY = bottom + innerH * 0.26;
    graphics.moveTo(left + 3, railY);
    graphics.lineTo(left + innerW - 3, railY);
    for (let i = 1; i < 4; i += 1) {
      const barX = left + (innerW * i) / 4;
      graphics.moveTo(barX, bottom + 3);
      graphics.lineTo(barX, railY);
    }
    graphics.stroke();
  }
}
