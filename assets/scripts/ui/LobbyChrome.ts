// STATUS: implemented, W25 P0-C 大厅外围：胶囊资源 HUD（扣安全区、数字右锚防溢出）、一行四枚玩法入口、底部合规文字链
import { Button, Color, Graphics, Label, Node, UITransform } from 'cc';
import { makeLabel } from './FontKit';
import {
  lobbyEntryRowY,
  lobbyHudLeft,
  lobbyHudTop,
  lobbyLinksY,
  lobbyStartY,
} from './LobbyLayout';
import { playStaggerIn } from './MotionKit';
import { addPill } from './PanelKit';
import { pinTopLeftAt } from './SafeLayout';
import { fitRow, fitWidth } from './ScreenMetrics';
import { COLORS } from './Tokens';
import { addUIButton, decorateButton } from './UIButton';

const PILL_W = 176;
const PILL_H = 56;
const PILL_GAP = 14;
const PILL_DOT_X = -56;
const PILL_DOT_R = 13;
/** 数字右锚 + 96 上限 + SHRINK：五位数也只会缩字号，不会压到左边的色点（qa-7）。 */
const PILL_NUM_W = 96;
const PILL_NUM_RIGHT = 80;
/** 四枚入口的半行宽：fitRow 在 ±325 里铺满，单枚 152（方案 §2.2 的 MENU_W）。 */
const MENU_SPAN = 325;
const MENU_GAP = 14;
const MENU_H = 78;
const LINK_SIZE = 22;
const LINK_GAP = 32;
const LINK_TOUCH_H = 44;
/** 小屋是长线回访入口，用雾蓝和其余次级入口分开，但不去抢主按钮的陶土色。 */
const MENU_TINT: Record<string, Color> = { HabitatButton: COLORS.mist };

/** 玩法入口一行四枚：合规类另走底部文字链，同层同权重的问题（audit-10）在这里关掉。 */
export const LOBBY_MENU: ReadonlyArray<readonly [string, string]> = [
  ['HospitalButton', '医院'],
  ['HabitatButton', '宠物小屋'],
  ['CodexButton', '图鉴'],
  ['LeaderboardButton', '排行榜'],
];

/** 合规入口：小字号文字链常驻屏底，不和玩法抢按钮。 */
export const LOBBY_LINKS: ReadonlyArray<readonly [string, string]> = [
  ['PrivacyButton', '隐私与协议'],
  ['AboutButton', '关于'],
];

export interface HudHandle {
  set(coins: number, hearts: number): void;
}

/** 资源 HUD：两枚胶囊横排贴安全区左上角，数字与图标分层。 */
export function mountHud(parent: Node): HudHandle {
  const left = lobbyHudLeft();
  const coin = addResourcePill(parent, 'CoinPill', COLORS.gold, left);
  const heart = addResourcePill(parent, 'HeartPill', COLORS.danger, left + PILL_W + PILL_GAP);
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
  graphics.circle(PILL_DOT_X, 0, PILL_DOT_R);
  graphics.fill();
  const label = makeLabel(pill, `${name}Label`, '0', 0, { size: 24, width: PILL_NUM_W, x: PILL_NUM_RIGHT });
  label.node.getComponent(UITransform)?.setAnchorPoint(1, 0.5);
  label.horizontalAlign = Label.HorizontalAlign.RIGHT;
  label.overflow = Label.Overflow.SHRINK;
  return label;
}

export function buildLobbyMenu(parent: Node, onMenuClick: (name: string) => void): void {
  const row = fitRow(LOBBY_MENU.length, -MENU_SPAN, MENU_SPAN, MENU_GAP);
  const nodes: Node[] = [];
  LOBBY_MENU.forEach(([name, text], index) => {
    const button = addUIButton(parent, name, text, () => onMenuClick(name), {
      y: lobbyEntryRowY(),
      x: row.x0 + index * row.step,
      width: row.width,
      height: MENU_H,
      color: MENU_TINT[name] ?? COLORS.sage,
      fontSize: 24,
    });
    nodes.push(button.node);
  });
  playStaggerIn(nodes);
}

/** 底部文字链：只给合规入口，字号 22、触控区补到 44，不抢玩法按钮的视觉权重。 */
export function buildLobbyLinks(parent: Node, onMenuClick: (name: string) => void): void {
  const widths = LOBBY_LINKS.map(([, text]) => text.length * LINK_SIZE);
  const total = widths.reduce((sum, width) => sum + width, 0) + LINK_GAP * (widths.length - 1);
  let cursor = -total / 2;
  LOBBY_LINKS.forEach(([name, text], index) => {
    const width = widths[index] ?? LINK_SIZE;
    const label = makeLabel(parent, name, text, lobbyLinksY(), {
      size: LINK_SIZE,
      width,
      x: cursor + width / 2,
      color: COLORS.sub,
    });
    const transform = label.node.getComponent(UITransform);
    transform?.setContentSize(width, LINK_TOUCH_H);
    label.node.on(Node.EventType.TOUCH_END, () => onMenuClick(name));
    cursor += width + LINK_GAP;
  });
}

/** 场景里的 Start 是白字空按钮：换九宫格底、放大到 520×112、改主行动文案。 */
export function styleStartButton(button: Button, text: string): void {
  decorateButton(button, text, {
    y: lobbyStartY(),
    width: fitWidth(520),
    height: 112,
    fontSize: 38,
    color: COLORS.clay,
  });
}
