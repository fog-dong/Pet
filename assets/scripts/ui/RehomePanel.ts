// STATUS: implemented, W25 P2-D 送养面板（信息 + 审核动作；审核中每秒刷新倒计时，到点自动换成领结果）
import { BlockInputEvents, Color, Node } from 'cc';
import { Save } from '../cache/Save';
import { RehomeClaim, rehomeQuote } from '../game/RehomeModel';
import { addCard } from './PanelKit';
import { enterPanel, leavePanel } from './PanelMotion';
import { buildRehomeActions, RehomeActionsHandle } from './RehomeActions';
import { buildRehomeInfo } from './RehomeInfo';
import { showRehomeResult } from './RehomeResult';
import { addLabel, addRect } from './SceneUI';
import { fitWidth, screenHeight, screenWidth } from './ScreenMetrics';
import { showToast } from './Toast';
import { HEX, tint } from './Tokens';

const PANEL_H = 860;

let overlay: Node | null = null;
let actions: RehomeActionsHandle | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let toastHost: Node | null = null;
let onChangedCb: (() => void) | undefined;
let onSettledCb: (() => void) | undefined;

export function closeRehomePanel(): void {
  stopTimer();
  leavePanel(overlay);
  overlay = null;
  actions = null;
  toastHost = null;
  onChangedCb = undefined;
  onSettledCb = undefined;
}

/** onSettled 只在送养成功、宠物已移出小屋后触发，调用方负责重建小屋列表。 */
export function openRehomePanel(
  parent: Node,
  petId: string,
  onChanged?: () => void,
  onSettled?: () => void,
): void {
  closeRehomePanel();
  Save.load();
  const quote = rehomeQuote(petId);
  if (!quote) {
    showToast(parent, '这只宠物不在小屋里');
    return;
  }
  toastHost = parent;
  onChangedCb = onChanged;
  onSettledCb = onSettled;
  overlay = addRect(parent, 'RehomeOverlay', 0, screenWidth(), screenHeight(), new Color(0, 0, 0, 150));
  overlay.addComponent(BlockInputEvents);
  overlay.setSiblingIndex(parent.children.length - 1);
  const panel = addCard(overlay, 'RehomePanel', 0, fitWidth(1040, 30), PANEL_H, { color: tint(HEX.wall) });
  addLabel(panel, 'RehomeTitle', '送 养', 385, { size: 36 });
  buildRehomeInfo(panel, petId, quote);
  actions = buildRehomeActions(panel, petId, {
    notify,
    onChanged: () => onChangedCb?.(),
    onClaim: handleClaim,
    onClose: closeRehomePanel,
  });
  timer = setInterval(() => actions?.tick(), 1000);
  enterPanel(overlay, panel);
}

function handleClaim(claim: RehomeClaim): void {
  if (claim.kind === 'blocked') {
    notify(claim.text);
    actions?.tick();
    return;
  }
  stopTimer();
  if (!overlay) {
    return;
  }
  // 结果页是面板的子节点：先关整块面板再回调，否则重建的小屋会把结果页压在下面。
  const changed = onChangedCb;
  const settled = onSettledCb;
  showRehomeResult(overlay, claim, () => {
    closeRehomePanel();
    if (claim.kind === 'adopted') {
      settled?.();
    } else {
      changed?.();
    }
  });
}

function notify(text: string): void {
  if (toastHost) {
    showToast(toastHost, text);
  }
}

function stopTimer(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
