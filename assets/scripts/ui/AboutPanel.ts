// STATUS: implemented, W9-9 关于面板（医疗虚构免责 + 适龄 + 忠告 + 联系客服，文案全取自 LegalConfig；面板走安全区避让）
import { BlockInputEvents, Color, Node } from 'cc';
import {
  AGE_RATING_TEXT,
  CUSTOMER_SERVICE,
  customerServiceReady,
  HEALTH_GAME_NOTICE_TEXT,
  MEDICAL_DISCLAIMER_TEXT,
} from '../config/LegalConfig';
import { openCustomerService, supportFallback } from '../net/Support';
import { Track } from '../track/Track';
import { addLabel, addRect, PALETTE } from './SceneUI';
import { addDialogButton, PANEL_H, PANEL_W } from './PrivacyDialogKit';
import { attachSafeArea } from './SafeLayout';

let overlay: Node | null = null;

function close(): void {
  if (overlay) {
    overlay.destroy();
  }
  overlay = null;
}

/** 提审必需的三类固定文案（免责 / 适龄 / 客服）集中在一屏，游客模式也可访问。 */
export function openAboutPanel(parent: Node): void {
  if (overlay) {
    return;
  }
  Track.track('about_panel_open');
  overlay = addRect(parent, 'AboutOverlay', 0, 1280, 720, new Color(0, 0, 0, 170));
  overlay.addComponent(BlockInputEvents);
  const panel = addRect(overlay, 'AboutPanel', 0, PANEL_W, PANEL_H, PALETTE.panel);
  attachSafeArea(panel);
  addLabel(panel, 'AboutTitle', '关 于', 235, { size: 34 });
  addLabel(panel, 'AboutAge', AGE_RATING_TEXT, 170, { size: 26 });
  addLabel(panel, 'AboutMedical', MEDICAL_DISCLAIMER_TEXT, 100, { size: 22, width: 860 });
  addLabel(panel, 'AboutNotice', HEALTH_GAME_NOTICE_TEXT, 0, { size: 20, color: PALETTE.sub, width: 860 });
  const hint = addLabel(panel, 'AboutSupportHint', '', -95, { size: 20, color: PALETTE.sub, width: 860 });
  addDialogButton(panel, 'AboutSupport', '联 系 客 服', -190, PALETTE.primary, () => {
    void openCustomerService().then((result) => {
      Track.track('customer_service_result', { result });
      hint.string = supportFallback(result) || '已为你打开客服会话。';
    });
  });
  addDialogButton(panel, 'AboutClose', '关 闭', 190, PALETTE.secondary, () => close());
  if (!customerServiceReady()) {
    hint.string = CUSTOMER_SERVICE.fallbackText;
  }
}
