// STATUS: implemented, W20-2 大厅内嵌宠物小屋面板（G3-A 不新建场景；整块盖在大厅之上，只让 Toast 压在它上面）
// W25 P0-B：点行开互动弹窗的链已删，动作改由卡片内的图标 / 立绘直接触发。
// W25 P1-C：面板与卡片随装修主题上色，右上角开装修弹窗，点立绘额外弹一条治愈气泡。
import { BlockInputEvents, Color, Label, Node } from 'cc';
import { Save } from '../cache/Save';
import { habitatList, runHabitatAction } from '../game/HabitatModel';
import { HabitatAction } from '../game/HabitatRules';
import { currentHabitatTheme } from '../game/HabitatThemes';
import { addLabel, addRect, PALETTE } from './SceneUI';
import { addCard, addDivider } from './PanelKit';
import { enterPanel, leavePanel } from './PanelMotion';
import { fitWidth, screenHeight, screenWidth } from './ScreenMetrics';
import { Point } from './ParticleKit';
import { HabitatRow } from './HabitatRows';
import { buildHabitatList } from './HabitatList';
import { habitatHintText, localToHost } from './HabitatTapActions';
import { attachHeartsGuide } from './HabitatShortfallGuide';
import { playFeedback } from './HabitatFeedback';
import { buildHabitatFooter } from './HabitatFooter';
import { showHealBubble } from './HabitatBubble';
import { paintRoomHeader } from './HabitatThemeArt';
import { addThemeEntry, closeThemePicker, openThemePicker } from './HabitatThemePanel';
import { openCareFromRow, makeRowRefresh, openRehomeFromRow, RowRefresh } from './HabitatCardActions';
import { closeCarePanel } from './CarePanel';
import { closeRehomePanel } from './RehomePanel';
import { showToast } from './Toast';
import { tint } from './Tokens';

const PANEL_H = 780;
const EMPTY_TEXT = '小屋空荡荡的，快去救助一只吧';

let overlay: Node | null = null;
let rows: HabitatRow[] = [];
let hint: Label | null = null;
let toastHost: Node | null = null;
let resourcesChanged: (() => void) | undefined;
let refreshRow: RowRefresh | null = null;

export function closeHabitatPanel(): void {
  closeThemePicker();
  closeRehomePanel();
  closeCarePanel();
  if (!overlay) {
    return;
  }
  leavePanel(overlay);
  overlay = null;
  rows = [];
  hint = null;
  toastHost = null;
  resourcesChanged = undefined;
  refreshRow = null;
}

export function openHabitatPanel(parent: Node, onResourcesChanged?: () => void, focusPetId?: string): void {
  closeHabitatPanel();
  Save.load();
  const entries = habitatList();
  const theme = currentHabitatTheme();
  // 大厅的木桌、按钮、提示都在同一层父节点上；追加到末尾 + 全屏遮罩才压得住，也不会被桌沿挡住。
  overlay = addRect(parent, 'HabitatOverlay', 0, screenWidth(), screenHeight(), new Color(0, 0, 0, 150));
  overlay.addComponent(BlockInputEvents);
  overlay.setSiblingIndex(parent.children.length - 1);
  toastHost = parent;
  resourcesChanged = onResourcesChanged;

  const width = fitWidth(1040, 30);
  const panel = addCard(overlay, 'HabitatPanel', 0, width, PANEL_H, { color: tint(theme.panel) });
  paintRoomHeader(panel, width, theme);
  addLabel(panel, 'HabitatTitle', `宠 物 小 屋　${entries.length} 只`, 352, { size: 34 });
  addDivider(panel, 302, width - 100);
  addThemeEntry(panel, width, openDecor);
  if (entries.length === 0) {
    addLabel(panel, 'HabitatEmpty', EMPTY_TEXT, 40, { size: 28, color: PALETTE.sub, width: width - 120 });
  } else {
    hint = addLabel(panel, 'HabitatQuotaLabel', habitatHintText(), 272, { size: 18, color: PALETTE.sub, width: width - 60 });
    // W28 P1-2：缺爱心时在引导行那一格挂可点出路；节点挂在遮罩下，随面板一起销毁，不留模块状态。
    const guide = attachHeartsGuide(panel, () => hint, closeHabitatPanel);
    const refresh = makeRowRefresh(() => rows, () => hint, () => resourcesChanged, () => guide);
    refreshRow = refresh;
    const onCare = (row: HabitatRow): void => {
      if (overlay) {
        openCareFromRow(overlay, row, refresh);
      }
    };
    const onRehome = (row: HabitatRow): void => {
      if (overlay) {
        openRehomeFromRow(overlay, row, refresh, reskin);
      }
    };
    rows = buildHabitatList(panel, entries, width, focusPetId, tint(theme.card), fire, onCare, onRehome);
  }
  // 底部两枚按钮（领取回执 + 关闭）在 HabitatFooter 里，本文件只管列表与遮罩。
  buildHabitatFooter(panel, width, parent, closeHabitatPanel, onResourcesChanged);
  enterPanel(overlay, panel);
}

function openDecor(): void {
  if (!overlay || !toastHost) {
    return;
  }
  // 指引条要把玩家送到大厅 TAB，所以连小屋遮罩一起摘掉，只关弹窗会跳了看不见。
  openThemePicker(overlay, toastHost, reskin, resourcesChanged, closeHabitatPanel);
}

/** 装修切换后整块面板重建：底色、卡片底色与窗景都由主题重新算，比原地改色少一堆状态。 */
function reskin(): void {
  const host = toastHost;
  const changed = resourcesChanged;
  if (!host || !host.isValid) {
    return;
  }
  closeHabitatPanel();
  openHabitatPanel(host, changed);
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
  if (action === 'pet') {
    const head = localToHost(row.node, host, { x: row.portrait.x, y: row.portrait.y + 132 });
    showHealBubble(host, head.x, head.y);
  }
  const outcome = runHabitatAction(row.entry.petId, action);
  if (outcome.kind === 'done') {
    refreshRow?.(row, outcome.entry);
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
