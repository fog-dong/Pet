// STATUS: implemented, W16 P1 大厅骨架：胶囊资源 HUD / 2×2 次级菜单 / 主按钮样式（从 Lobby 拆出，保持单文件 ≤150 行）
import { Button, Color, Graphics, Label, Node, UITransform } from 'cc';
import { makeLabel } from './FontKit';
import { addPill } from './PanelKit';
import { pinTopLeftAt } from './SafeLayout';
import { COLORS } from './Tokens';
import { addUIButton, decorateButton } from './UIButton';

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

export interface HudHandle {
  set(coins: number, hearts: number): void;
}

/** 资源 HUD：两枚胶囊横排贴安全区左上角，数字与图标分层。 */
export function mountHud(parent: Node): HudHandle {
  const coin = addResourcePill(parent, 'CoinPill', COLORS.gold, 24);
  const heart = addResourcePill(parent, 'HeartPill', COLORS.danger, 244);
  return {
    set(coins: number, hearts: number): void {
      coin.string = String(coins);
      heart.string = String(hearts);
    },
  };
}

function addResourcePill(parent: Node, name: string, color: Color, left: number): Label {
  const pill = addPill(parent, name, 0, 200, 64, COLORS.white);
  pinTopLeftAt(pill, left, 24);
  const dot = new Node(`${name}Dot`);
  dot.parent = pill;
  dot.addComponent(UITransform).setContentSize(32, 32);
  const graphics = dot.addComponent(Graphics);
  graphics.fillColor = color;
  graphics.circle(-62, 0, 15);
  graphics.fill();
  return makeLabel(pill, `${name}Label`, '0', 0, { size: 26, width: 116, x: 18 });
}

export function buildLobbyMenu(parent: Node, onMenuClick: (name: string) => void): void {
  LOBBY_MENU.forEach(([name, text], index) => {
    const x = index % 2 === 0 ? -MENU_X : MENU_X;
    const y = index < 2 ? MENU_ROW1 : MENU_ROW2;
    addUIButton(parent, name, text, () => onMenuClick(name), {
      y,
      x,
      width: MENU_W,
      height: MENU_H,
      color: COLORS.sage,
      fontSize: 26,
    });
  });
}

/** 场景里的 Start 是白字空按钮：换九宫格底、放大到 520×112、改主行动文案。 */
export function styleStartButton(button: Button, text: string): void {
  decorateButton(button, text, { y: 229, width: 520, height: 112, fontSize: 38, color: COLORS.clay });
}
