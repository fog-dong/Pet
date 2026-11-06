// STATUS: implemented, W27 P3-UI 成就面板骨架（遮罩 + 称号条 + 行区 ScrollView + 底部关闭；滚动句柄外抛供复位）
import { BlockInputEvents, Color, Label, Mask, Node, ScrollView, UITransform } from 'cc';
import { COPY } from '../config/CopyText';
import { addLabel, addRect, createNode } from './SceneUI';
import { addPill } from './PanelKit';
import { enterPanel } from './PanelMotion';
import { makeLabel } from './FontKit';
import { addUIButton } from './UIButton';
import { addGlyphBadge } from './GlyphKit';
import { fitWidth, safeAreaBottom, safeAreaTop, screenHeight, screenWidth } from './ScreenMetrics';
import { COLORS } from './Tokens';

const AUTHORED_W = 900;
const MAX_H = 1000;
const MIN_H = 720;
/** 顶部标题 / 称号条 / 行区 / 底部按钮四段的纵向预算。 */
const HEAD_BLOCK = 178;
const FOOT_BLOCK = 150;
const ROW_INSET = 22;
const BAR_BADGE = 36;

interface RowsScroll {
  content: Node;
  scroll: ScrollView;
  viewportH: number;
}

export interface AchievementChrome {
  overlay: Node;
  panel: Node;
  titleText: Label;
  rowHost: Node;
  /** 视口高：行区渲染时要拿它和真实列表高取大，写回 content。 */
  viewportH: number;
  scroll: ScrollView;
  hint: Label;
}

/** 遮罩必须在最后进父节点：任何后挂的彩色块都盖不到面板。 */
export function buildAchievementChrome(parent: Node, onClose: () => void): AchievementChrome {
  const width = fitWidth(AUTHORED_W, 30);
  const height = Math.min(MAX_H, Math.max(MIN_H, screenHeight() - safeAreaTop() - safeAreaBottom() - 120));
  const centerY = (safeAreaBottom() - safeAreaTop()) / 2;
  const overlay = addRect(parent, 'AchievementOverlay', 0, screenWidth(), screenHeight(), new Color(0, 0, 0, 150));
  overlay.addComponent(BlockInputEvents);
  overlay.setSiblingIndex(parent.children.length - 1);
  const panel = addRect(overlay, 'AchievementPanel', centerY, width, height, COLORS.paper);
  const top = height / 2;

  addLabel(panel, 'AchievementHeading', COPY.achievementTitle, top - 52, { size: 36, color: COLORS.ink });
  const bar = addPill(panel, 'AchievementTitleBar', top - 118, width - 70, 62, COLORS.skirt);
  const barWidth = width - 70;
  addGlyphBadge(bar, 'AchievementTitleIcon', 'trophy', BAR_BADGE, COLORS.clay, COLORS.white)
    .setPosition(-barWidth / 2 + 30, 0, 0);
  const titleText = makeLabel(bar, 'AchievementTitleBarText', '', 0, {
    size: 22,
    width: barWidth - 96,
    x: 26,
    color: COLORS.ink,
  });

  const rows = buildRowsScroll(panel, width, height);
  const hint = addLabel(panel, 'AchievementHint', '', -height / 2 + FOOT_BLOCK - 38, {
    size: 20,
    color: COLORS.sub,
    width: width - 60,
  });
  addUIButton(panel, 'AchievementClose', '关 闭', onClose, {
    y: -height / 2 + 58,
    width: 200,
    height: 64,
    color: COLORS.clay,
    fontSize: 26,
  });
  enterPanel(overlay, panel);
  return { overlay, panel, titleText, rowHost: rows.content, viewportH: rows.viewportH, scroll: rows.scroll, hint };
}

function buildRowsScroll(panel: Node, width: number, height: number): RowsScroll {
  const viewportH = Math.max(240, height - HEAD_BLOCK - FOOT_BLOCK);
  const scrollNode = createNode(panel, 'AchievementScroll', height / 2 - HEAD_BLOCK - viewportH / 2, width - ROW_INSET * 2, viewportH);
  const scroll = scrollNode.addComponent(ScrollView);
  const view = createNode(scrollNode, 'view', 0, width - ROW_INSET * 2, viewportH);
  view.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
  const content = new Node('content');
  content.parent = view;
  const transform = content.addComponent(UITransform);
  transform.setContentSize(width - ROW_INSET * 2 - 20, viewportH);
  transform.setAnchorPoint(0.5, 1);
  content.setPosition(0, viewportH / 2, 0);
  scroll.content = content;
  scroll.vertical = true;
  scroll.horizontal = false;
  return { content, scroll, viewportH };
}
