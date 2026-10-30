// STATUS: implemented, W3 通用兜底面板（失败 / 资源不足的三条免费路径）
import { BlockInputEvents, Color, Label, Node } from 'cc';
import { addButton, addLabel, addRect, PALETTE, setButtonState } from './SceneUI';
import { fitWidth, screenHeight, screenWidth } from './ScreenMetrics';

export interface PanelAction {
  text: string;
  action: () => void;
  color?: Color;
  disabled?: boolean;
}

const PANEL_HEIGHT = 560;

export class ChoicePanel {
  private node: Node | null = null;
  private hint: Label | null = null;

  get isOpen(): boolean {
    return this.node !== null && this.node.isValid;
  }

  open(parent: Node, title: string, actions: readonly PanelAction[]): void {
    this.close();
    const width = fitWidth(900, 30);
    const height = Math.min(PANEL_HEIGHT, screenHeight() - 120);
    const overlay = addRect(parent, 'ChoiceOverlay', 0, screenWidth(), screenHeight(), new Color(40, 32, 26, 120));
    overlay.addComponent(BlockInputEvents);
    const panel = addRect(overlay, 'ChoicePanel', 0, width, height, PALETTE.panel);
    this.node = overlay;
    addLabel(panel, 'ChoiceTitle', title, 240, { size: 30, width: width - 80 });
    this.hint = addLabel(panel, 'ChoiceHint', '', 178, { size: 22, color: PALETTE.sub, width: width - 80 });
    actions.forEach((entry, index) => {
      const button = addButton(
        panel,
        `ChoiceAction${index}`,
        entry.text,
        100 - index * 100,
        entry.action,
        entry.color ?? PALETTE.secondary,
        Math.min(560, width - 40),
      );
      if (entry.disabled) {
        setButtonState(button, false);
      }
    });
  }

  setHint(text: string): void {
    if (this.hint) {
      this.hint.string = text;
    }
  }

  close(): void {
    if (this.node) {
      this.node.destroy();
    }
    this.node = null;
    this.hint = null;
  }
}
