// STATUS: implemented, W25 P2-B2 里程碑 / 领取弹窗（单层遮罩 + 标题 + 至多四行 + 至多两枚按钮）
import { BlockInputEvents, Color, Node } from 'cc';
import { COPY } from '../config/CopyText';
import { addCard } from './PanelKit';
import { addLabel, addRect } from './SceneUI';
import { screenHeight, screenWidth } from './ScreenMetrics';
import { COLORS } from './Tokens';
import { addUIButton } from './UIButton';

export interface MilestoneOptions {
  title: string;
  lines: readonly string[];
  hint?: string;
  /** 有 go 时是「去领取 + 稍后再看」，没有时只有一枚关闭按钮。 */
  go?: { text: string; onClick: () => void };
  closeText?: string;
}

export function showMilestone(parent: Node, options: MilestoneOptions): void {
  const overlay = addRect(parent, 'MilestoneOverlay', 0, screenWidth(), screenHeight(), new Color(0, 0, 0, 150));
  overlay.addComponent(BlockInputEvents);
  overlay.setSiblingIndex(parent.children.length - 1);
  const lines = options.lines.slice(0, 4);
  const height = 250 + lines.length * 42 + (options.hint ? 40 : 0);
  const card = addCard(overlay, 'MilestoneCard', 0, 560, height);
  const close = (): void => {
    if (overlay.isValid) {
      overlay.destroy();
    }
  };
  addLabel(card, 'MilestoneTitle', options.title, height / 2 - 54, { size: 32, color: COLORS.ink });
  lines.forEach((line, index) => {
    addLabel(card, `MilestoneLine${index}`, line, height / 2 - 108 - index * 42, {
      size: 24,
      color: COLORS.ink,
      width: 480,
    });
  });
  if (options.hint) {
    addLabel(card, 'MilestoneHint', options.hint, height / 2 - 108 - lines.length * 42 - 6, {
      size: 20,
      color: COLORS.sub,
      width: 480,
    });
  }
  const buttonY = -height / 2 + 62;
  if (options.go) {
    const go = options.go;
    addUIButton(card, 'MilestoneGo', go.text, () => {
      close();
      go.onClick();
    }, { y: buttonY, x: -140, width: 240, height: 70, color: COLORS.clay, fontSize: 26 });
    addUIButton(card, 'MilestoneLater', options.closeText ?? COPY.milestoneLater, close, {
      y: buttonY,
      x: 140,
      width: 240,
      height: 70,
      color: COLORS.sage,
      fontSize: 26,
    });
    return;
  }
  addUIButton(card, 'MilestoneLater', options.closeText ?? COPY.milestoneOk, close, {
    y: buttonY,
    width: 280,
    height: 70,
    color: COLORS.clay,
    fontSize: 26,
  });
}
