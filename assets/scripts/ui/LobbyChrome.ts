// STATUS: implemented, W26 P2-E 大厅外围：胶囊资源 HUD（扣安全区、数字右锚防溢出）+ 底部合规文字链
// 玩法入口已全部收进底部四枚常驻 TAB（见 LobbyTabs / LobbyDock），本文件不再排玩法按钮。
import { Color, Graphics, Label, Node, UITransform } from 'cc';
import { makeLabel } from './FontKit';
import { lobbyHudLeft, lobbyHudTop, lobbyLinksY } from './LobbyLayout';
import { addPill } from './PanelKit';
import { pinTopLeftAt } from './SafeLayout';
import { COLORS } from './Tokens';
import { bindPressEffect } from './UIButton';

const PILL_W = 176;
const PILL_H = 56;
const PILL_GAP = 14;
const PILL_DOT_X = -56;
const PILL_DOT_R = 13;
/** 数字右锚 + 96 上限 + SHRINK：五位数也只会缩字号，不会压到左边的色点（qa-7）。 */
const PILL_NUM_W = 96;
const PILL_NUM_RIGHT = 80;
const LINK_SIZE = 22;
const LINK_GAP = 32;
const LINK_TOUCH_H = 44;

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

/** 底部文字链：只给合规入口，字号 22、触控区补到 44，不抢玩法按钮的视觉权重。 */
export function buildLobbyLinks(parent: Node, onMenuClick: (name: string) => void): Node[] {
  const widths = LOBBY_LINKS.map(([, text]) => text.length * LINK_SIZE);
  const total = widths.reduce((sum, width) => sum + width, 0) + LINK_GAP * (widths.length - 1);
  let cursor = -total / 2;
  const nodes = LOBBY_LINKS.map(([name, text], index) => {
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
    bindPressEffect(label.node);
    cursor += width + LINK_GAP;
    return label.node;
  });
  raiseToTop(nodes);
  return nodes;
}

/**
 * 合规链是屏底唯一必须点得着的东西：内容坞与 TAB 栏都在它上方，但后挂的成就角标、
 * 同步角标与常驻提示会把它压到下层，所以每次重排都把它整体提到根节点最上层（P2-E 模块二「幽灵层级」）。
 */
export function raiseToTop(nodes: readonly Node[]): void {
  nodes.forEach((node) => {
    const parent = node.parent;
    if (parent) {
      node.setSiblingIndex(parent.children.length - 1);
    }
  });
}
