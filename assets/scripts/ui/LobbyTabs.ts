// STATUS: implemented, W26 P2-E 大厅四枚常驻 TAB（诊疗 / 后院 / 小屋 / 成就），替代原来的一行五枚玩法入口
import { Node, UIOpacity } from 'cc';
import { lobbyTabBarY, TAB_H } from './LobbyDockLayout';
import { addCard } from './PanelKit';
import { fitRow, fitWidth } from './ScreenMetrics';
import { COLORS } from './Tokens';
import { addUIButton, setUIButtonState } from './UIButton';

export type LobbyTab = 'clinic' | 'garden' | 'habitat' | 'achieve';

/** 顺序即屏上从左到右；诊疗排在最前，因为寻访是每日第一动作。 */
export const LOBBY_TABS: readonly (readonly [LobbyTab, string])[] = [
  ['clinic', '诊 疗'],
  ['garden', '后 院'],
  ['habitat', '小 屋'],
  ['achieve', '成 就'],
];

const BAR_W = 704;
const SIDE_INSET = 10;
const TAB_GAP_X = 12;
/** TAB 上下各收 8，留在木底里露出一条边，读成「嵌在抽屉上的键」而不是浮在上面。 */
const TAB_INSET = 8;
/** 未选中档：靠颜色分主次已经够，这里再压一档透明度，避免四枚同权重糊成一片。 */
const IDLE_ALPHA = 205;

export interface TabBarHandle {
  setActive(tab: LobbyTab): void;
  node: Node;
}

export function buildLobbyTabs(parent: Node, onTab: (tab: LobbyTab) => void): TabBarHandle {
  const width = fitWidth(BAR_W, 8);
  const board = addCard(parent, 'LobbyTabBar', lobbyTabBarY(), width, TAB_H, {
    radius: 26,
    color: COLORS.paper,
    shadow: false,
  });
  const row = fitRow(LOBBY_TABS.length, -width / 2 + SIDE_INSET, width / 2 - SIDE_INSET, TAB_GAP_X);
  const items = LOBBY_TABS.map(([tab, text], index) => ({
    tab,
    text,
    button: addUIButton(board, `Tab_${tab}`, text, () => onTab(tab), {
      y: 0,
      x: row.x0 + index * row.step,
      width: row.width,
      height: TAB_H - TAB_INSET * 2,
      color: COLORS.sage,
      fontSize: 26,
    }),
  }));
  const setActive = (next: LobbyTab): void => {
    items.forEach((item) => {
      setUIButtonState(item.button, true, item.text, item.tab === next ? COLORS.clay : COLORS.sage);
      const opacity = item.button.node.getComponent(UIOpacity) ?? item.button.node.addComponent(UIOpacity);
      opacity.opacity = item.tab === next ? 255 : IDLE_ALPHA;
    });
  };
  setActive('clinic');
  return { setActive, node: board };
}
