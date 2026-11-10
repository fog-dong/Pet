// STATUS: implemented, W31 主题双联预览的两块小房间（左大厅 / 右小屋），纯 Graphics 现画，不加载贴图
import { Color, Graphics, Node, UITransform } from 'cc';
import { HabitatTheme } from '../game/HabitatThemes';
import { addLabel } from './SceneUI';
import { tint } from './Tokens';
import { paintWindow } from './HabitatThemeWindow';

const INK = '#4A3F35';

/** 大厅小样：墙面 + 地板 + 门 + 窗 + 标题 + 底部四格 TAB；门与 TAB 分列两层，互不遮挡。 */
export function paintMiniLobby(parent: Node, theme: HabitatTheme, width: number, height: number): void {
  const node = frame(parent, `MiniLobby_${theme.id}`, width, height, theme);
  const g = node.getComponent(Graphics)!;
  const floorH = height * 0.24;
  g.fillColor = tint(theme.floor);
  g.rect(-width / 2, -height / 2, width, floorH);
  g.fill();
  g.fillColor = tint(theme.accent, 90);
  g.ellipse(width * 0.06, -height / 2 + floorH * 0.52, width * 0.24, floorH * 0.36);
  g.fill();
  // 门贴左墙立在地板线上，门把在右缘；底部 TAB 条另起一层压住门脚。
  const doorW = width * 0.2;
  const doorH = height * 0.38;
  g.fillColor = tint(theme.accent, 215);
  g.roundRect(-width * 0.42, -height / 2, doorW, doorH, 6);
  g.fill();
  g.fillColor = tint(theme.panel, 235);
  g.circle(-width * 0.42 + doorW - 10, -height / 2 + doorH * 0.46, 3.2);
  g.fill();
  paintWindow(g, width * 0.22, height * 0.1, width * 0.34, height * 0.26, theme);
  addLabel(node, 'MiniLobbyTitle', '萌宠救助日记', height * 0.36, {
    size: 15, color: tint(INK), x: -width * 0.16, width: width * 0.56,
  });
  g.fillColor = tint(theme.panel, 225);
  g.roundRect(-width / 2 + 6, -height / 2 + 6, width - 12, 26, 8);
  g.fill();
  const tabs = ['诊疗', '后院', '小屋', '成就'];
  tabs.forEach((text, index) => {
    const x = -width * 0.33 + (index * width * 0.22);
    addLabel(node, `MiniLobbyTab_${index}`, text, -height / 2 + 19, { size: 11, color: tint(INK), x });
  });
}

/** 小屋小样：墙 + 地板 + 地毯 + 窗，右下三条属性条说明「回家也能看到状态」。 */
export function paintMiniRoom(parent: Node, theme: HabitatTheme, width: number, height: number): void {
  const node = frame(parent, `MiniRoom_${theme.id}`, width, height, theme);
  const g = node.getComponent(Graphics)!;
  const floorH = height * 0.3;
  g.fillColor = tint(theme.floor);
  g.rect(-width / 2, -height / 2, width, floorH);
  g.fill();
  g.fillColor = tint(theme.accent, 90);
  g.ellipse(0, -height / 2 + floorH * 0.6, width * 0.3, floorH * 0.34);
  g.fill();
  paintWindow(g, 0, height * 0.18, width * 0.5, height * 0.34, theme);
  g.fillColor = tint(theme.accent, 230);
  g.roundRect(-width / 2 + 8, -height * 0.06, 10, height * 0.5, 5);
  g.fill();
  g.roundRect(width / 2 - 18, -height * 0.06, 10, height * 0.5, 5);
  g.fill();
  const bars = [0.92, 0.66, 0.44];
  bars.forEach((fill, index) => {
    const y = -height / 2 + floorH + 18 + index * 14;
    g.fillColor = new Color(255, 255, 255, 200);
    g.roundRect(-width * 0.4, y, width * 0.52, 7, 3.5);
    g.fill();
    g.fillColor = index === 0 ? tint('#E3B23C') : tint(theme.accent);
    g.roundRect(-width * 0.4, y, width * 0.52 * fill, 7, 3.5);
    g.fill();
  });
}

function frame(parent: Node, name: string, width: number, height: number, theme: HabitatTheme): Node {
  const node = new Node(name);
  node.parent = parent;
  node.addComponent(UITransform).setContentSize(width, height);
  const g = node.addComponent(Graphics);
  g.fillColor = tint(theme.panel);
  g.roundRect(-width / 2, -height / 2, width, height, 14);
  g.fill();
  g.fillColor = tint(theme.wall);
  g.roundRect(-width / 2 + 3, -height / 2 + 3, width - 6, height - 6, 12);
  g.fill();
  return node;
}
