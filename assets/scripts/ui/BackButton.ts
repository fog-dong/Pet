// STATUS: implemented, W18 全局左上角返回（进行中的小游戏走“放弃当前病患”二次确认）
import { BlockInputEvents, Button, Color, Node } from 'cc';
import { addButton, addLabel, addRect } from './SceneUI';
import { addCard } from './PanelKit';
import { safeAreaTop, screenHeight, screenWidth } from './ScreenMetrics';
import { COLORS } from './Tokens';
import { addUIButton } from './UIButton';

/** 六个子页共用：左上角统一位置，刘海屏按安全区下移。 */
export function mountBackButton(parent: Node, onBack: () => void, confirm = false): Button {
  const button = addUIButton(parent, 'BackButton', '← 返回', () => {
    if (confirm) {
      openAbandonDialog(parent, onBack);
      return;
    }
    onBack();
  }, {
    y: screenHeight() / 2 - 74 - safeAreaTop(),
    x: -screenWidth() / 2 + 96,
    width: 136,
    height: 58,
    color: COLORS.sage,
    fontSize: 23,
    radius: 20,
  });
  button.node.setSiblingIndex(parent.children.length - 1);
  return button;
}

/** 只在小游戏/流程进行中弹出；确认后由调用方清会话并回大厅。 */
export function openAbandonDialog(parent: Node, onAbandon: () => void): void {
  if (parent.getChildByName('AbandonOverlay')) {
    return;
  }
  const overlay = addRect(parent, 'AbandonOverlay', 0, screenWidth(), screenHeight(), new Color(30, 24, 18, 150));
  overlay.setSiblingIndex(parent.children.length - 1);
  overlay.addComponent(BlockInputEvents);
  const panel = addCard(overlay, 'AbandonPanel', 0, 580, 360);
  addLabel(panel, 'AbandonTitle', '是否放弃当前病患？', 112, { size: 30, width: 500 });
  addLabel(panel, 'AbandonHint', '离开后本局诊断与治疗进度不会保留', 64, {
    size: 22,
    color: COLORS.sub,
    width: 500,
  });
  addButton(panel, 'AbandonStay', '继续救治', -16, () => overlay.destroy(), COLORS.sage, 440, 80);
  addButton(panel, 'AbandonLeave', '放弃，回大厅', -114, () => {
    overlay.destroy();
    onAbandon();
  }, COLORS.danger, 440, 80);
}
