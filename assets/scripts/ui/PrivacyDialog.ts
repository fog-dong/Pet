// STATUS: implemented, W9-9 隐私与协议弹窗（勾选才同意；不同意走游客模式，不退出游戏；面板走安全区避让）
import { BlockInputEvents, Button, Color, Node } from 'cc';
import { PRIVACY_CHECK_TEXT, PRIVACY_DECLINE_TEXT, PRIVACY_DECLINE_TITLE, PRIVACY_GUEST_TEXT } from '../config/LegalConfig';
import { WxPrivacy } from '../net/Privacy';
import { addLabel, addRect, createNode, PALETTE, setButtonState } from './SceneUI';
import { addDialogButton, buildDocScroll, paintCheckBox, PANEL_H, PANEL_W } from './PrivacyDialogKit';
import { attachSafeArea } from './SafeLayout';

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
  body = createNode(panel, 'PrivacyBody', 0, PANEL_W, PANEL_H);
  buildDocScroll(body, 55);
  const row = addRect(body, 'PrivacyCheck', -128, 880, 60, new Color(247, 241, 232, 255));
  paintCheckBox(row, checked);
  addLabel(row, 'CheckText', PRIVACY_CHECK_TEXT, 0, { size: 24, width: 740, x: 60 });
  agreeButton = addDialogButton(body, 'PrivacyAgree', '请先勾选协议', -190, PALETTE.primary, () => {
    if (!checked) {
      return;
    }
    const onAgree = settings.onAgree;
    closePrivacyDialog();
    onAgree?.();
  });
  setButtonState(agreeButton, false);
  addDialogButton(body, 'PrivacyDecline', '暂不同意', 190, PALETTE.secondary, () => renderDeclined(panel));
  // 整行 880×60 都是热区，手指点文字也能勾选。
  row.on(Node.EventType.TOUCH_END, () => {
    checked = !checked;
    paintCheckBox(row, checked);
    if (agreeButton) {
      setButtonState(agreeButton, checked, checked ? '同意并进入' : '请先勾选协议');
    }
  });
}

function renderDeclined(panel: Node): void {
  if (body) {
    body.destroy();
  }
  checked = false;
  agreeButton = null;
  body = createNode(panel, 'PrivacyDeclineBody', 0, PANEL_W, PANEL_H);
  addLabel(body, 'DeclineTitle', PRIVACY_DECLINE_TITLE, 170, { size: 30 });
  addLabel(body, 'DeclineText', PRIVACY_DECLINE_TEXT, 90, { size: 24, color: PALETTE.sub, width: 820 });
  addLabel(body, 'DeclineGuest', PRIVACY_GUEST_TEXT, 40, { size: 22, color: PALETTE.sub, width: 820 });
  addLabel(body, 'DeclineHint', '进入大厅后仍可在「隐私与协议」里随时查看正文。', 0, {
    size: 22,
    color: PALETTE.sub,
    width: 820,
  });
  addDialogButton(body, 'PrivacyReread', '重新阅读协议', -190, PALETTE.primary, () => renderGate(panel));
  addDialogButton(body, 'PrivacyGuest', '仅体验基础内容', 190, PALETTE.secondary, () => {
    const onGuest = settings.onGuest;
    closePrivacyDialog();
    onGuest?.();
  });
}

function renderRead(panel: Node): void {
  body = createNode(panel, 'PrivacyReadBody', 0, PANEL_W, PANEL_H);
  buildDocScroll(body, 45);
  const hint = addLabel(body, 'ContractHint', '', -150, { size: 20, color: PALETTE.sub, width: 820 });
  addDialogButton(body, 'PrivacyContract', '平台隐私指引', -190, PALETTE.secondary, () => {
    if (!WxPrivacy.openContract()) {
      hint.string = '当前环境不支持平台隐私指引，请以上方正文为准。';
    }
  });
  addDialogButton(body, 'PrivacyClose', '关 闭', 190, PALETTE.primary, () => {
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
  overlay = addRect(parent, 'PrivacyOverlay', 0, 1280, 720, new Color(0, 0, 0, 170));
  overlay.addComponent(BlockInputEvents);
  // 面板必须四边 Widget + SafeArea 才会被收进安全区，只挂 SafeArea 时引擎静默跳过。
  const panel = addRect(overlay, 'PrivacyPanel', 0, PANEL_W, PANEL_H, PALETTE.panel);
  attachSafeArea(panel);
  addLabel(panel, 'PrivacyTitle', '隐私保护与用户协议', 250, { size: 34 });
  if (next.mode === 'gate') {
    renderGate(panel);
    return;
  }
  renderRead(panel);
}

export function closePrivacyDialog(): void {
  if (body) {
    body.destroy();
  }
  body = null;
  agreeButton = null;
  if (overlay) {
    overlay.destroy();
  }
  overlay = null;
}
