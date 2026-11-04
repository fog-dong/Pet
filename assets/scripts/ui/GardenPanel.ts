// STATUS: implemented, W25 P2-C 后院面板（草药库存 + 种植/合成两页签；倒计时 1s 刷新，关闭即清）
import { BlockInputEvents, Color, Node } from 'cc';
import { Save } from '../cache/Save';
import { buildGardenHeader, GardenHeaderHandle, GardenTab } from './GardenHeader';
import { buildGardenPlots, GardenPlotsHandle } from './GardenPlots';
import { buildGardenRecipes, GardenRecipesHandle } from './GardenRecipes';
import { addCard } from './PanelKit';
import { addLabel, addRect, createNode } from './SceneUI';
import { fitWidth, screenHeight, screenWidth } from './ScreenMetrics';
import { showToast } from './Toast';
import { addUIButton } from './UIButton';
import { COLORS, HEX, tint } from './Tokens';

const PANEL_H = 800;
const CONTENT_W = 620;
const CONTENT_H = 440;
const CONTENT_Y = -62;

let overlay: Node | null = null;
let panel: Node | null = null;
let content: Node | null = null;
let header: GardenHeaderHandle | null = null;
let tab: GardenTab = 'plots';
let plots: GardenPlotsHandle | null = null;
let recipes: GardenRecipesHandle | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let toastHost: Node | null = null;
let changedCb: (() => void) | undefined;
let closedCb: (() => void) | undefined;

export function closeGardenPanel(): void {
  stopTimer();
  if (overlay) {
    overlay.destroy();
  }
  overlay = null;
  panel = null;
  content = null;
  header = null;
  plots = null;
  recipes = null;
  toastHost = null;
  changedCb = undefined;
  const done = closedCb;
  closedCb = undefined;
  if (done) {
    done();
  }
}

export function openGardenPanel(parent: Node, onChanged?: () => void, onClosed?: () => void): void {
  closeGardenPanel();
  Save.load();
  toastHost = parent;
  changedCb = onChanged;
  closedCb = onClosed;
  tab = 'plots';
  overlay = addRect(parent, 'GardenOverlay', 0, screenWidth(), screenHeight(), new Color(0, 0, 0, 150));
  overlay.addComponent(BlockInputEvents);
  overlay.setSiblingIndex(parent.children.length - 1);
  buildPanel();
  timer = setInterval(() => {
    plots?.refresh();
  }, 1000);
}

function buildPanel(): void {
  if (!overlay) {
    return;
  }
  const width = fitWidth(1040, 30);
  panel = addCard(overlay, 'GardenPanel', 0, width, PANEL_H, { color: tint(HEX.wall) });
  addLabel(panel, 'GardenTitle', '后 院', 352, { size: 36 });
  header = buildGardenHeader(panel, width, tab, switchTab);
  content = createNode(panel, 'GardenContent', CONTENT_Y, CONTENT_W, CONTENT_H);
  buildContent();
  addUIButton(panel, 'GardenClose', '关闭', closeGardenPanel, {
    y: -352,
    width: 260,
    height: 68,
    color: COLORS.sage,
    fontSize: 28,
  });
  header.refresh();
}

function switchTab(next: GardenTab): void {
  if (next === tab) {
    return;
  }
  tab = next;
  header?.setTab(next);
  buildContent();
}

function buildContent(): void {
  if (!content || !panel) {
    return;
  }
  content.destroyAllChildren();
  plots = null;
  recipes = null;
  if (tab === 'plots') {
    plots = buildGardenPlots(content, panel, notify, refreshAll);
    return;
  }
  recipes = buildGardenRecipes(content, notify, refreshAll);
}

/** 每次产出后：刷新库存/倒计时/配方余量，并把金币变化同步回大厅 HUD。 */
function refreshAll(): void {
  header?.refresh();
  plots?.refresh();
  recipes?.sync();
  if (changedCb) {
    changedCb();
  }
}

function notify(text: string): void {
  if (toastHost) {
    // 后院面板 800 高，默认 -320 的 Toast 会压住 -352 的关闭键，往下挪到面板外。
    showToast(toastHost, text, { y: -470 });
  }
}

function stopTimer(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
