// STATUS: implemented, W20-1 大厅外围：胶囊资源 HUD（扣安全区）/ 次级菜单（贴桌沿两行）/ 主按钮样式
import { Button, Color, Graphics, Label, Node, UITransform } from 'cc';
import { makeLabel } from './FontKit';
import { lobbyHudTop, lobbyMenuRow, lobbyStartY } from './LobbyLayout';
import { playStaggerIn } from './MotionKit';
import { addPill } from './PanelKit';
import { pinTopLeftAt } from './SafeLayout';
import { COLORS } from './Tokens';
import { addUIButton, decorateButton } from './UIButton';

const PILL_W = 176;
const PILL_H = 56;
const PILL_GAP = 14;
const MENU_W = 200;
const MENU_GAP = 20;
const MENU_H = 78;

/** 次级入口：首行三枚（医院 / 图鉴 / 排行榜），次行两枚（隐私 / 关于）；顺序即数组顺序。 */
export const LOBBY_MENU: ReadonlyArray<readonly [string, string]> = [
  ['HospitalButton', '医院'],
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
  const heart = addResourcePill(parent, 'HeartPill', COLORS.danger, 24 + PILL_W + PILL_GAP);
  return {
    set(coins: number, hearts: number): void {
      coin.string = String(coins);
      heart.string = String(hearts);
    },
  };
}

function addResourcePill(parent: Node, name: string, color: Color, left: number): Label {
  const pill = addPill(parent, name, 0, PILL_W, PILL_H, COLORS.white);
  pinTopLeftAt(pill, left, lobbyHudTop());
  const dot = new Node(`${name}Dot`);
  dot.parent = pill;
  dot.addComponent(UITransform).setContentSize(28, 28);
  const graphics = dot.addComponent(Graphics);
  graphics.fillColor = color;
  graphics.circle(-56, 0, 13);
  graphics.fill();
  return makeLabel(pill, `${name}Label`, '0', 0, { size: 24, width: 104, x: 16 });
}

export function buildLobbyMenu(parent: Node, onMenuClick: (name: string) => void): void {
  // 首行三枚（医院 / 图鉴 / 排行榜），次行两枚（隐私 / 关于），两行共用同一套列心。
  const topCount = LOBBY_MENU.length - 2;
  const nodes: Node[] = [];
  LOBBY_MENU.forEach(([name, text], index) => {
    const inTop = index < topCount;
    const slot = inTop ? index : index - topCount;
    const columns = inTop ? topCount : 2;
    const x = (slot - (columns - 1) / 2) * (MENU_W + MENU_GAP);
    const button = addUIButton(parent, name, text, () => onMenuClick(name), {
      y: lobbyMenuRow(inTop ? 0 : 1),
      x,
      width: MENU_W,
      height: MENU_H,
      color: COLORS.sage,
      fontSize: 26,
    });
    nodes.push(button.node);
  });
  playStaggerIn(nodes);
}

/** 场景里的 Start 是白字空按钮：换九宫格底、放大到 520×112、改主行动文案。 */
export function styleStartButton(button: Button, text: string): void {
  decorateButton(button, text, { y: lobbyStartY(), width: 520, height: 112, fontSize: 38, color: COLORS.clay });
}
