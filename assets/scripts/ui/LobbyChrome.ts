// STATUS: implemented, W16-1 大厅中轴骨架：主按钮样式与 2×2 次级菜单列（从 Lobby 拆出，保持单文件 ≤150 行）
import { Button, Color, Label, Node, UITransform } from 'cc';
import { addButton, PALETTE, paintRect } from './SceneUI';

const MENU_W = 214;
const MENU_H = 78;
const MENU_X = 115;
const MENU_ROW1 = -210;
const MENU_ROW2 = -302;

/** 次级入口：两行两列，顺序即数组顺序。 */
export const LOBBY_MENU: ReadonlyArray<readonly [string, string]> = [
  ['CodexButton', '图鉴'],
  ['LeaderboardButton', '排行榜'],
  ['PrivacyButton', '隐私与协议'],
  ['AboutButton', '关于'],
];

export function buildLobbyMenu(parent: Node, onMenuClick: (name: string) => void): void {
  LOBBY_MENU.forEach(([name, text], index) => {
    const x = index % 2 === 0 ? -MENU_X : MENU_X;
    const y = index < 2 ? MENU_ROW1 : MENU_ROW2;
    addButton(parent, name, text, y, () => onMenuClick(name), PALETTE.secondary, MENU_W, MENU_H, x);
  });
}

/** 场景里的 Start 是白字空按钮：补主色底、挪到中轴、换中文文案。 */
export function styleStartButton(button: Button, x: number, y: number, text: string): void {
  button.node.setPosition(x, y, 0);
  const size = button.node.getComponent(UITransform)?.contentSize;
  paintRect(button.node, size?.width ?? 420, size?.height ?? 100, PALETTE.primary);
  const label = button.node.children
    .map((child) => child.getComponent(Label))
    .find((item): item is Label => item !== null);
  if (!label) {
    return;
  }
  label.string = text;
  label.fontSize = 34;
  label.color = new Color(255, 255, 255, 255);
}
