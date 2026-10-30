// STATUS: implemented, W11-2 隐私与协议弹窗（勾选才同意；不同意走游客模式，不退出游戏；面板走安全区避让）
import { BlockInputEvents, Button, Color, Node } from 'cc';
import { PRIVACY_CHECK_TEXT, PRIVACY_DECLINE_TEXT, PRIVACY_DECLINE_TITLE, PRIVACY_GUEST_TEXT } from '../config/LegalConfig';
import { PrivacyState } from '../cache/PrivacyState';
import { agreePrivacy, startCloudSync } from '../core/BootCloud';
import type { CloudSyncStart } from '../core/BootCloud';
import { WxPrivacy } from '../net/Privacy';
import { Track } from '../track/Track';
import { addLabel, addRect, createNode, PALETTE, setButtonState } from './SceneUI';
import { addDialogButton, buildDocScroll, buttonX, paintCheckBox, panelH, panelW } from './PrivacyDialogKit';
import { attachSafeArea } from './SafeLayout';
import { screenHeight, screenWidth } from './ScreenMetrics';

export interface PrivacyDialogOptions {
  readonly mode: 'gate' | 'read';
  readonly onAgree?: () => void;
  readonly onGuest?: () => void;
  readonly onClose?: () => void;
}

let overlay: Node | null = null;
let body: Node | null = null;
let agreeButton: Button | null = null;
let settings: PrivacyDialogOptions = { mode: 'read' };
let checked = false;

function renderGate(panel: Node): void {
  body = createNode(panel, 'PrivacyBody', 0, panelW(), panelH());
  buildDocScroll(body, 75);
  // 正文是滚动区：给一句可滑动的说明，避免玩家把遮罩边缘当成文字被截断。
  addLabel(body, 'PrivacyScrollHint', '上下滑动可查看完整协议', -102, {
    size: 19,
    color: PALETTE.sub,
  });
  const row = addRect(body, 'PrivacyCheck', -155, panelW() - 100, 60, new Color(247, 241, 232, 255));
  paintCheckBox(row, checked);
  addLabel(row, 'CheckText', PRIVACY_CHECK_TEXT, 0, { size: 24, width: panelW() - 240, x: 60 });
  agreeButton = addDialogButton(body, 'PrivacyAgree', '请先勾选协议', -buttonX(), PALETTE.primary, () => {
    if (!checked) {
      return;
    }
    const onAgree = settings.onAgree;
    closePrivacyDialog();
    onAgree?.();
  });
  setButtonState(agreeButton, false);
  addDialogButton(body, 'PrivacyDecline', '暂不同意', buttonX(), PALETTE.secondary, () => renderDeclined(panel));
  // 整行（panelW-100 × 60）都是热区，手指点文字也能勾选。
  row.on(Node.EventType.TOUCH_END, () => {
    checked = !checked;
    paintCheckBox(row, checked);
    if (agreeButton) {
      setButtonState(agreeButton, checked, checked ? '同意并进入' : '请先勾选协议');
    }
  });
}

function renderDeclined(panel: Node): void {
  if (body) { body.destroy(); }
  checked = false;
  agreeButton = null;
  body = createNode(panel, 'PrivacyDeclineBody', 0, panelW(), panelH());
  const textW = panelW() - 160;
  addLabel(body, 'DeclineTitle', PRIVACY_DECLINE_TITLE, 170, { size: 30 });
  addLabel(body, 'DeclineText', PRIVACY_DECLINE_TEXT, 90, { size: 24, color: PALETTE.sub, width: textW });
  addLabel(body, 'DeclineGuest', PRIVACY_GUEST_TEXT, 40, { size: 22, color: PALETTE.sub, width: textW });
  addLabel(body, 'DeclineHint', '进入大厅后仍可在「隐私与协议」里随时查看正文。', 0, {
    size: 22,
    color: PALETTE.sub,
    width: textW,
  });
  addDialogButton(body, 'PrivacyReread', '重新阅读协议', -buttonX(), PALETTE.primary, () => renderGate(panel));
  addDialogButton(body, 'PrivacyGuest', '仅体验基础内容', buttonX(), PALETTE.secondary, () => {
    const onGuest = settings.onGuest;
    closePrivacyDialog();
    onGuest?.();
  });
}

function renderRead(panel: Node): void {
  body = createNode(panel, 'PrivacyReadBody', 0, panelW(), panelH());
  buildDocScroll(body, 75);
  addLabel(body, 'PrivacyScrollHint', '上下滑动可查看完整协议', -102, {
    size: 19,
    color: PALETTE.sub,
  });
  const hint = addLabel(body, 'ContractHint', '', -150, { size: 20, color: PALETTE.sub, width: panelW() - 160 });
  addDialogButton(body, 'PrivacyContract', '平台隐私指引', -buttonX(), PALETTE.secondary, () => {
    if (!WxPrivacy.openContract()) {
      hint.string = '当前环境不支持平台隐私指引，请以上方正文为准。';
    }
  });
  addDialogButton(body, 'PrivacyClose', '关 闭', buttonX(), PALETTE.primary, () => {
    const onClose = settings.onClose;
    closePrivacyDialog();
    onClose?.();
  });
}

export function openPrivacyDialog(parent: Node, next: PrivacyDialogOptions): void {
  if (overlay) {
    return;
  }
  settings = next;
  checked = false;
  overlay = addRect(parent, 'PrivacyOverlay', 0, screenWidth(), screenHeight(), new Color(0, 0, 0, 170));
  overlay.addComponent(BlockInputEvents);
  // 面板必须四边 Widget + SafeArea 才会被收进安全区，只挂 SafeArea 时引擎静默跳过。
  const panel = addRect(overlay, 'PrivacyPanel', 0, panelW(), panelH(), PALETTE.panel);
  attachSafeArea(panel);
  addLabel(panel, 'PrivacyTitle', '隐私保护与用户协议', 250, { size: 34 });
  if (next.mode === 'gate') {
    renderGate(panel);
    return;
  }
  renderRead(panel);
}

export function closePrivacyDialog(): void {
  if (body) { body.destroy(); }
  body = null;
  agreeButton = null;
  if (overlay) {
    overlay.destroy();
  }
  overlay = null;
}

/**
 * 常驻入口共用（大厅「隐私与协议」、关于面板「隐私授权」）：
 * 已同意只读正文；游客期不主动重弹，但点这里会走与首次启动完全一致的授权窗，
 * 同意后立刻写 acceptedVersion 并接回云端；login 失败不阻塞当前单局，下次启动按已同意状态重跑。
 * `onAgreed` 拿到的是「登录 + 补发」的完成信号，调用方可据此刷新待同步提示。
 */
export function openPrivacyEntry(parent: Node, onAgreed?: (cloud: CloudSyncStart) => void): void {
  if (PrivacyState.accepted()) {
    Track.track('privacy_entry_read');
    openPrivacyDialog(parent, { mode: 'read' });
    return;
  }
  Track.track('privacy_entry_gate', { guest: PrivacyState.isGuest() });
  openPrivacyDialog(parent, {
    mode: 'gate',
    onAgree: (): void => {
      agreePrivacy();
      onAgreed?.(startCloudSync());
    },
  });
}
