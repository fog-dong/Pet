// STATUS: implemented, W20-2 大厅内嵌宠物小屋面板（G3-A 不新建场景；整块盖在大厅之上，只让 Toast 压在它上面）
// W25 P0-B：点行开互动弹窗的链已删，动作改由卡片内的图标 / 立绘直接触发；本文件只做列表编排与派发。
import { BlockInputEvents, Color, Label, Mask, Node, ScrollView, UITransform } from 'cc';
import { HabitatPet } from '../cache/HabitatCodec';
import { Save } from '../cache/Save';
import { habitatList, runHabitatAction } from '../game/HabitatModel';
import { HabitatAction } from '../game/HabitatRules';
import { addLabel, addRect, createNode, PALETTE } from './SceneUI';
import { addCard, addDivider } from './PanelKit';
import { fitWidth, screenHeight, screenWidth } from './ScreenMetrics';
import { Point } from './ParticleKit';
import { applyStats, buildHabitatRow, HABITAT_CARD_H, HabitatRow } from './HabitatRows';
import { habitatHintText, localToHost } from './HabitatTapActions';
import { playFeedback } from './HabitatFeedback';
import { buildHabitatFooter } from './HabitatFooter';
import { showToast } from './Toast';

const PANEL_H = 780;
/** 视口高度刻意留到 500：底部要空出 35px 给滚动提示，别让最后一张卡压着文字。 */
const VIEW_H = 500;
/** 卡片比旧版宽 20：立绘放大到 190 后左右两栏需要这点余量，560 是面板 660 减两侧 50。 */
const CARD_SIDE = 50;
const EMPTY_TEXT = '小屋空荡荡的，快去救助一只吧';

let overlay: Node | null = null;
let rows: HabitatRow[] = [];
let hint: Label | null = null;
let toastHost: Node | null = null;
let resourcesChanged: (() => void) | undefined;

export function closeHabitatPanel(): void {
  if (!overlay) {
    return;
  }
  overlay.destroy();
  overlay = null;
  rows = [];
  hint = null;
  toastHost = null;
  resourcesChanged = undefined;
}

export function openHabitatPanel(parent: Node, onResourcesChanged?: () => void): void {
  closeHabitatPanel();
  Save.load();
  const entries = habitatList();
  // 大厅的木桌、按钮、提示都在同一层父节点上；追加到末尾 + 全屏遮罩才压得住，也不会被桌沿挡住。
  overlay = addRect(parent, 'HabitatOverlay', 0, screenWidth(), screenHeight(), new Color(0, 0, 0, 150));
  overlay.addComponent(BlockInputEvents);
  overlay.setSiblingIndex(parent.children.length - 1);
  toastHost = parent;
  resourcesChanged = onResourcesChanged;

  const width = fitWidth(1040, 30);
  const panel = addCard(overlay, 'HabitatPanel', 0, width, PANEL_H, { color: PALETTE.panel });
  addLabel(panel, 'HabitatTitle', `宠 物 小 屋　${entries.length} 只`, 340, { size: 34 });
  addDivider(panel, 302, width - 100);
  if (entries.length === 0) {
    addLabel(panel, 'HabitatEmpty', EMPTY_TEXT, 40, { size: 28, color: PALETTE.sub, width: width - 120 });
  } else {
    hint = addLabel(panel, 'HabitatQuotaLabel', habitatHintText(), 272, { size: 18, color: PALETTE.sub, width: width - 60 });
    buildList(panel, entries, width);
    if (entries.length > 2) {
      addLabel(panel, 'HabitatScrollHint', '上下拖动可以翻看全部宠物', -285, { size: 20, color: PALETTE.sub });
    }
  }
  // 底部两枚按钮（领取回执 + 关闭）在 HabitatFooter 里，本文件只管列表与遮罩。
  buildHabitatFooter(panel, width, parent, closeHabitatPanel, onResourcesChanged);
}

function buildList(panel: Node, entries: readonly HabitatPet[], panelWidth: number): void {
  const viewW = panelWidth - 80;
  const cardW = panelWidth - CARD_SIDE * 2;
  const scrollNode = createNode(panel, 'HabitatScroll', 0, viewW, VIEW_H);
  const view = createNode(scrollNode, 'HabitatView', 0, viewW, VIEW_H);
  view.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
  const content = new Node('HabitatContent');
  content.parent = view;
  const transform = content.addComponent(UITransform);
  transform.setContentSize(cardW, Math.max(VIEW_H, entries.length * HABITAT_CARD_H));
  transform.setAnchorPoint(0.5, 1);
  content.setPosition(0, VIEW_H / 2, 0);
  rows = entries.map((entry, index) => buildHabitatRow(content, index, entry, cardW, fire));

  const scroll = scrollNode.addComponent(ScrollView);
  scroll.content = content;
  scroll.vertical = true;
  scroll.horizontal = false;
  scroll.brake = 0.72;
}

/**
 * 一次互动的完整闭环：扣费改属性 → 刷这一行的三条进度条 → 全列表重新判可负担 → 演反馈。
 * 反馈层的粒子挂在遮罩上，卡片坐标要经 localToHost 换算，否则滚动后粒子会飞错位置。
 */
function fire(row: HabitatRow, action: HabitatAction, origin: Point, touchX: number): void {
  if (!overlay) {
    return;
  }
  const host = overlay;
  const outcome = runHabitatAction(row.entry.petId, action);
  if (outcome.kind === 'done') {
    applyStats(row.stats, outcome.entry);
    rows.forEach((item) => item.syncAfford());
    if (hint && hint.isValid) {
      hint.string = habitatHintText();
    }
    if (resourcesChanged) {
      resourcesChanged();
    }
  }
  playFeedback(
    host,
    action,
    row.visual,
    outcome,
    notify,
    localToHost(row.node, host, row.portrait),
    localToHost(row.node, host, origin),
    touchX,
  );
}

function notify(text: string): void {
  if (toastHost) {
    showToast(toastHost, text);
  }
}
