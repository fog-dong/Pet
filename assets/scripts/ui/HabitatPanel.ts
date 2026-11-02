// STATUS: implemented, W20-2 大厅内嵌宠物小屋面板（G3-A 不新建场景；整块盖在大厅之上，只让 Toast 压在它上面）
import { BlockInputEvents, Color, Mask, Node, ScrollView, UITransform } from 'cc';
import { HabitatPet } from '../cache/HabitatCodec';
import { Save } from '../cache/Save';
import { habitatList, runHabitatAction } from '../game/HabitatModel';
import { claimOfflineEarnings } from '../game/HabitatClaim';
import { addLabel, addRect, createNode, PALETTE } from './SceneUI';
import { addCard, addDivider } from './PanelKit';
import { fitRow, fitWidth, screenHeight, screenWidth } from './ScreenMetrics';
import { applyStats, buildHabitatRow, HABITAT_CARD_H, HabitatRow } from './HabitatRows';
import { closeHabitatMenu, openHabitatMenu } from './HabitatMenu';
import { floatText } from './FloatText';
import { showToast } from './Toast';
import { COLORS } from './Tokens';
import { addUIButton } from './UIButton';

const PANEL_H = 780;
/** 视口高度刻意留到 500：底部要空出 35px 给滚动提示，别让最后一张卡压着文字。 */
const VIEW_H = 500;
const EMPTY_TEXT = '小屋空荡荡的，快去救助一只吧';
const CLAIM_LABEL = '离线收益 · 待领取';
/** 飘字落在按钮上方，视线从按钮移到数字只需一小跳。 */
const CLAIM_FLOAT_Y = -290;

let overlay: Node | null = null;

export function closeHabitatPanel(): void {
  if (!overlay) {
    return;
  }
  closeHabitatMenu();
  overlay.destroy();
  overlay = null;
}

export function openHabitatPanel(parent: Node, onResourcesChanged?: () => void): void {
  closeHabitatPanel();
  Save.load();
  const entries = habitatList();
  // 大厅的木桌、按钮、提示都在同一层父节点上；追加到末尾 + 全屏遮罩才压得住，也不会被桌沿挡住。
  overlay = addRect(parent, 'HabitatOverlay', 0, screenWidth(), screenHeight(), new Color(0, 0, 0, 150));
  overlay.addComponent(BlockInputEvents);
  overlay.setSiblingIndex(parent.children.length - 1);

  const width = fitWidth(1040, 30);
  const panel = addCard(overlay, 'HabitatPanel', 0, width, PANEL_H, { color: PALETTE.panel });
  addLabel(panel, 'HabitatTitle', `宠 物 小 屋　${entries.length} 只`, 340, { size: 34 });
  addDivider(panel, 302, width - 100);
  if (entries.length === 0) {
    addLabel(panel, 'HabitatEmpty', EMPTY_TEXT, 40, { size: 28, color: PALETTE.sub, width: width - 120 });
  } else {
    buildList(panel, entries, width, parent, onResourcesChanged);
    if (entries.length > 3) {
      addLabel(panel, 'HabitatScrollHint', '上下拖动可以翻看全部宠物', -285, { size: 20, color: PALETTE.sub });
    }
  }
  buildFooter(panel, width, parent, onResourcesChanged);
}

/**
 * 底部两枚按钮：离线收益只由服务端事务计时结算（G4 红线），客户端只发领取请求并照抄返回数额；
 * 右侧留关闭，主次同排不抢列表的视觉重心。
 */
function buildFooter(panel: Node, panelWidth: number, toastHost: Node, onResourcesChanged?: () => void): void {
  const row = fitRow(2, -(panelWidth / 2 - 40), panelWidth / 2 - 40, 24);
  addUIButton(panel, 'HabitatClaim', CLAIM_LABEL, () => {
    void claimReward(panel, toastHost, onResourcesChanged);
  }, {
    y: -340,
    x: row.x0,
    width: row.width,
    height: 76,
    color: COLORS.gold,
    fontSize: 26,
  });
  addUIButton(panel, 'HabitatClose', '关 闭', () => closeHabitatPanel(), {
    y: -340,
    x: row.x0 + row.step,
    width: row.width,
    height: 76,
    color: COLORS.sage,
    fontSize: 28,
  });
}

/** 领取结果一律给反馈：成功飘金币 + Toast，频控/断网只给 Toast，连点第二个请求静默吞掉。 */
async function claimReward(panel: Node, toastHost: Node, onResourcesChanged?: () => void): Promise<void> {
  const outcome = await claimOfflineEarnings();
  if (outcome.kind === 'busy') {
    return;
  }
  if (outcome.kind === 'granted') {
    if (panel.isValid) {
      floatText(panel, `+${outcome.coins} 金币`, 0, CLAIM_FLOAT_Y);
    }
    if (onResourcesChanged) {
      onResourcesChanged();
    }
  }
  showToast(toastHost, outcome.text);
}

function buildList(
  panel: Node,
  entries: readonly HabitatPet[],
  panelWidth: number,
  toastHost: Node,
  onResourcesChanged?: () => void,
): void {
  const viewW = panelWidth - 80;
  const cardW = panelWidth - 120;
  const scrollNode = createNode(panel, 'HabitatScroll', 0, viewW, VIEW_H);
  const view = createNode(scrollNode, 'HabitatView', 0, viewW, VIEW_H);
  view.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
  const content = new Node('HabitatContent');
  content.parent = view;
  const transform = content.addComponent(UITransform);
  transform.setContentSize(cardW, Math.max(VIEW_H, entries.length * HABITAT_CARD_H));
  transform.setAnchorPoint(0.5, 1);
  content.setPosition(0, VIEW_H / 2, 0);
  entries.forEach((entry, index) => {
    buildHabitatRow(content, index, entry, cardW, (row) => openRowMenu(row, toastHost, onResourcesChanged));
  });

  const scroll = scrollNode.addComponent(ScrollView);
  scroll.content = content;
  scroll.vertical = true;
  scroll.horizontal = false;
  scroll.brake = 0.72;
}

/** 点一行开互动菜单；成功就地刷新这一行的三条进度条与大厅资源 HUD。 */
function openRowMenu(row: HabitatRow, toastHost: Node, onResourcesChanged?: () => void): void {
  if (!overlay) {
    return;
  }
  const host = overlay;
  openHabitatMenu(host, row.entry, (action) => {
    const outcome = runHabitatAction(row.entry.petId, action);
    if (outcome.kind === 'done') {
      applyStats(row.stats, outcome.entry);
      if (onResourcesChanged) {
        onResourcesChanged();
      }
    }
    return outcome;
  }, (text) => showToast(toastHost, text));
}
