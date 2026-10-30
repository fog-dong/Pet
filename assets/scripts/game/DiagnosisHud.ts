// STATUS: implemented, W4 诊断小游戏共用倒计时与提示行（拍片/化验）
import { Label, Node } from 'cc';
import { addLabel, PALETTE } from '../ui/SceneUI';

export class DiagnosisHud {
  private readonly timer: Label;
  private readonly hint: Label;

  constructor(root: Node, prefix: string, hintText: string) {
    this.timer = addLabel(root, `${prefix}Timer`, '', 330, { size: 26, color: PALETTE.primary, x: 440 });
    this.hint = addLabel(root, `${prefix}Hint`, hintText, -258, { size: 22, color: PALETTE.sub, width: 900 });
  }

  paint(msLeft: number): void {
    this.timer.string = `剩余 ${Math.max(0, Math.ceil(msLeft / 1000))}s`;
  }

  setHint(text: string): void {
    this.hint.string = text;
  }
}
