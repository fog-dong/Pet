// STATUS: implemented, W25 P1-C 小屋主题窗景（Graphics 现画；不新增贴图，换主题只换配色与窗内元素）
// 三处落笔：标题带（门牌窗景）、左右墙饰条、装修小店缩略图；W31 缩略图补窗帘与地毯，读得出是「真实房间」。
import { Graphics, Node, UITransform } from 'cc';
import { HabitatTheme } from '../game/HabitatThemes';
import { tint } from './Tokens';
import { paintWindow } from './HabitatThemeWindow';

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
  paintWindow(graphics, -width / 2 + 60, BAND_Y, 92, 44, theme);
}

/** 装修小店缩略图：墙 + 窗帘 + 地板 + 地毯 + 窗，铺满给定尺寸。 */
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
  const floorH = height * 0.26;
  graphics.fillColor = tint(theme.floor);
  graphics.rect(-width / 2 + 4, -height / 2 + 3, width - 8, floorH);
  graphics.fill();
  // 地毯：比地板深一档的椭圆，让小图有「房间」而不是「色块」的读法
  graphics.fillColor = tint(theme.accent, 90);
  graphics.ellipse(0, -height / 2 + floorH * 0.62, width * 0.26, floorH * 0.32);
  graphics.fill();
  // 窗帘：左右各一条，主题色最直观的落点
  graphics.fillColor = tint(theme.accent, 220);
  graphics.roundRect(-width / 2 + 6, -height * 0.1, 12, height * 0.62, 6);
  graphics.fill();
  graphics.roundRect(width / 2 - 18, -height * 0.1, 12, height * 0.62, 6);
  graphics.fill();
  paintWindow(graphics, 0, height * 0.13, width * 0.56, height * 0.48, theme);
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
