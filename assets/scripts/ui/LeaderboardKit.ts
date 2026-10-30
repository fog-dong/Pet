// STATUS: implemented, W16 排行榜骨架（安全区面板 + 行区 ScrollView + 底部固定导航）
import { BlockInputEvents, Button, Color, Label, Mask, Node, ScrollView, UITransform } from 'cc';
import { addButton, addLabel, addRect, createNode, PALETTE } from './SceneUI';
import { fitWidth, safeAreaBottom, safeAreaTop, screenHeight, screenWidth } from './ScreenMetrics';

const AUTHORED_PANEL_W = 900;
const PANEL_MAX_H = 860;
const PANEL_MIN_H = 560;
/** 面板下沿距安全区底部的距离；底部导航再往里收 58。 */
const BOTTOM_GAP = 100;
const NAV_INSET = 58;

export interface LeaderboardChrome {
  overlay: Node;
  panel: Node;
  rowHost: Node;
  hint: Label;
  prev: Button;
  close: Button;
  next: Button;
}

export interface ChromeHandlers {
  onType: (type: 'weekly' | 'friends') => void;
  onTurn: (delta: number) => void;
  onClose: () => void;
}

/** 面板高度随可视高度伸缩，下沿固定贴安全区，短屏也不会把导航顶出屏幕。 */
export function buildLeaderboardChrome(parent: Node, handlers: ChromeHandlers): LeaderboardChrome {
  const width = fitWidth(AUTHORED_PANEL_W, 30);
  const height = Math.min(PANEL_MAX_H, Math.max(PANEL_MIN_H, screenHeight() - safeAreaTop() - safeAreaBottom() - 160));
  const centerY = safeAreaBottom() + BOTTOM_GAP + height / 2 - screenHeight() / 2;
  const overlay = addRect(parent, 'LeaderboardOverlay', 0, screenWidth(), screenHeight(), new Color(0, 0, 0, 140));
  overlay.addComponent(BlockInputEvents);
  // 遮罩必须在最后：面板节点先加进遮罩，任何后挂的彩色块都盖不到它。
  overlay.setSiblingIndex(parent.children.length - 1);
  const panel = addRect(overlay, 'LeaderboardPanel', centerY, width, height, PALETTE.panel);
  const top = height / 2;
  addLabel(panel, 'LeaderboardTitle', '排 行 榜', top - 55, { size: 36 });
  addButton(panel, 'LeaderboardWeekly', '本周榜', top - 135, () => handlers.onType('weekly'), PALETTE.accent, 220, 64, -130);
  addButton(panel, 'LeaderboardFriends', '好友榜', top - 135, () => handlers.onType('friends'), PALETTE.secondary, 220, 64, 130);
  const rowHost = buildRowsScroll(panel, width, top, height);
  const hint = addLabel(panel, 'LeaderboardHint', '', -height / 2 + 180, {
    size: 20,
    color: PALETTE.sub,
    width: width - 100,
  });
  const navY = -height / 2 + NAV_INSET;
  const navX = width / 2 - 160;
  const prev = addButton(panel, 'LeaderboardPrev', '上一页', navY, () => handlers.onTurn(-1), PALETTE.secondary, 180, 68, -navX);
  const close = addButton(panel, 'LeaderboardClose', '关闭', navY, handlers.onClose, PALETTE.primary, 180, 68, 0);
  const next = addButton(panel, 'LeaderboardNext', '下一页', navY, () => handlers.onTurn(1), PALETTE.secondary, 180, 68, navX);
  return { overlay, panel, rowHost, hint, prev, close, next };
}

/** 行区：可视高度 420 的上方到底部提示之间全部给 ScrollView，行多时纵向滚动。 */
function buildRowsScroll(panel: Node, width: number, top: number, height: number): Node {
  const scrollH = Math.max(180, height - 420);
  const scrollNode = createNode(panel, 'LeaderboardScroll', top - 190 - scrollH / 2, width - 70, scrollH);
  const scroll = scrollNode.addComponent(ScrollView);
  const view = createNode(scrollNode, 'view', 0, width - 70, scrollH);
  view.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
  const content = new Node('content');
  content.parent = view;
  const transform = content.addComponent(UITransform);
  transform.setContentSize(width - 90, scrollH);
  transform.setAnchorPoint(0.5, 1);
  content.setPosition(0, scrollH / 2, 0);
  scroll.content = content;
  scroll.vertical = true;
  scroll.horizontal = false;
  return content;
}
