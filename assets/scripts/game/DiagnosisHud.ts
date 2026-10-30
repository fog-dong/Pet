// STATUS: implemented, W16-2 诊断小游戏共用计时行（计时贴右、提示统一交给页面 Hint，避免两行文字叠在同一水线）
import { Label, Node } from 'cc';
import { addLabel, PALETTE } from '../ui/SceneUI';
import { rightEdgeX } from '../ui/ScreenMetrics';
import { DIAGNOSIS_HUD_Y } from './DiagnosisLayout';

export class DiagnosisHud {
  private readonly timer: Label;

  constructor(root: Node, prefix: string, private readonly onHint: (text: string) => void) {
    this.timer = addLabel(root, `${prefix}Timer`, '', DIAGNOSIS_HUD_Y, {
      size: 26,
      color: PALETTE.primary,
      width: 300,
      x: rightEdgeX(150),
    });
  }

  paint(msLeft: number): void {
    this.timer.string = `剩余 ${Math.max(0, Math.ceil(msLeft / 1000))}s`;
  }

  setHint(text: string): void {
    this.onHint(text);
  }
}
