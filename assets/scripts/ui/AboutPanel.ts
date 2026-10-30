// STATUS: implemented, W11-2 关于面板（医疗虚构免责 + 适龄 + 忠告 + 隐私授权 + 联系客服，文案全取自 LegalConfig）
import { BlockInputEvents, Button, Color, Node } from 'cc';
import {
  AGE_RATING_TEXT,
  CUSTOMER_SERVICE,
  customerServiceReady,
  HEALTH_GAME_NOTICE_TEXT,
  MEDICAL_DISCLAIMER_TEXT,
  PRIVACY_ENTRY_DONE,
  PRIVACY_ENTRY_TODO,
} from '../config/LegalConfig';
import { PrivacyState } from '../cache/PrivacyState';
import { openCustomerService, supportFallback } from '../net/Support';
import { Track } from '../track/Track';
import { addLabel, addRect, PALETTE } from './SceneUI';
import { addDialogButton, buttonX, panelH, panelW } from './PrivacyDialogKit';
import { openPrivacyEntry } from './PrivacyDialog';
import { attachSafeArea } from './SafeLayout';
import { screenHeight, screenWidth } from './ScreenMetrics';

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
  overlay = addRect(parent, 'AboutOverlay', 0, screenWidth(), screenHeight(), new Color(0, 0, 0, 170));
  overlay.addComponent(BlockInputEvents);
  const textW = panelW() - 120;
  const panel = addRect(overlay, 'AboutPanel', 0, panelW(), panelH(), PALETTE.panel);
  attachSafeArea(panel);
  addLabel(panel, 'AboutTitle', '关 于', 235, { size: 34 });
  addLabel(panel, 'AboutAge', AGE_RATING_TEXT, 170, { size: 26 });
  addLabel(panel, 'AboutMedical', MEDICAL_DISCLAIMER_TEXT, 100, { size: 22, width: textW });
  addLabel(panel, 'AboutNotice', HEALTH_GAME_NOTICE_TEXT, 0, { size: 20, color: PALETTE.sub, width: textW });
  const hint = addLabel(panel, 'AboutSupportHint', '', -70, { size: 20, color: PALETTE.sub, width: textW });
  // 游客期不主动重弹隐私窗，但这里始终保留升级入口；同意后本行就地变成只读入口。
  const privacyRow = addRect(panel, 'AboutPrivacy', -140, panelW() - 100, 56, new Color(247, 241, 232, 255));
  const privacyText = addLabel(privacyRow, 'AboutPrivacyLabel', '', 0, { size: 22, width: panelW() - 150 });
  privacyText.string = PrivacyState.accepted() ? PRIVACY_ENTRY_DONE : PRIVACY_ENTRY_TODO;
  privacyRow.addComponent(Button).transition = Button.Transition.NONE;
  privacyRow.on(Button.EventType.CLICK, (): void => {
    Track.track('about_privacy_click');
    openPrivacyEntry(parent, (cloud) => {
      // 等 login + 补发结束再翻成「已同意」，避免登录失败时提前宣称云端已启用。
      void cloud.done.then(() => {
        if (privacyText.isValid) {
          privacyText.string = PRIVACY_ENTRY_DONE;
        }
      });
    });
  });
  addDialogButton(panel, 'AboutSupport', '联 系 客 服', -buttonX(), PALETTE.primary, () => {
    void openCustomerService().then((result) => {
      Track.track('customer_service_result', { result });
      hint.string = supportFallback(result) || '已为你打开客服会话。';
    });
  });
  addDialogButton(panel, 'AboutClose', '关 闭', buttonX(), PALETTE.secondary, () => close());
  if (!customerServiceReady()) {
    hint.string = CUSTOMER_SERVICE.fallbackText;
  }
}
