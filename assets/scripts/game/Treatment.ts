// STATUS: implemented, W3 治疗页（药品/床位/时间 三组轻分配）
import { _decorator, Component, Label, Node } from 'cc';
import { CaseSession } from './CaseSession';
import { GameState } from '../core/GameFSM';
import { goState } from '../core/SceneFlow';
import { Ad } from '../net/Ad';
import { Track } from '../track/Track';
import { addButton, addLabel, PALETTE } from '../ui/SceneUI';

const { ccclass } = _decorator;

interface CycleButton {
  label: Label;
  options: string[];
  index: number;
}

@ccclass('Treatment')
export class Treatment extends Component {
  private medicine: CycleButton | null = null;
  private bed: CycleButton | null = null;
  private time: CycleButton | null = null;
  private hint: Label | null = null;

  protected start(): void {
    const item = CaseSession.current;
    if (!item) {
      void goState(GameState.Lobby, 'Lobby');
      return;
    }
    const root = this.node;
    addLabel(root, 'PageTitle', '治 疗', 280, { size: 46 });
    addLabel(root, 'PetName', `${item.petName} · ${item.breed}`, 200, { size: 30, color: PALETTE.sub });
    this.medicine = this.buildCycle(root, 'Medicine', '药品', item.treatment.medicine, 100);
    this.bed = this.buildCycle(root, 'Bed', '床位', item.treatment.bed, 5);
    this.time = this.buildCycle(root, 'Time', '时间', item.treatment.time, -90);
    this.hint = addLabel(root, 'Hint', '点击按钮切换方案，选好后开始治疗', -170, {
      size: 24,
      color: PALETTE.sub,
    });
    addButton(root, 'ConfirmButton', '开始治疗', -270, () => this.confirm());
  }

  private buildCycle(
    parent: Node,
    name: string,
    title: string,
    options: string[],
    y: number,
  ): CycleButton {
    const button = addButton(
      parent,
      `${name}Button`,
      `${title}：${options[0]}`,
      y,
      () => {
        state.index = (state.index + 1) % state.options.length;
        state.label.string = `${title}：${state.options[state.index]}`;
      },
      PALETTE.secondary,
      420,
    );
    const label = button.node.getChildByName(`${name}ButtonLabel`)?.getComponent(Label);
    if (!label) {
      throw new Error(`${name} label missing`);
    }
    const state: CycleButton = { label, options, index: 0 };
    return state;
  }

  private confirm(): void {
    const item = CaseSession.current;
    if (!item || !this.medicine || !this.bed || !this.time) {
      return;
    }
    const medicine = this.medicine.options[this.medicine.index];
    const bed = this.bed.options[this.bed.index];
    const time = this.time.options[this.time.index];
    const correct = item.treatment.correct;
    const score =
      (medicine === correct.medicine ? 1 : 0) +
      (bed === correct.bed ? 1 : 0) +
      (time === correct.time ? 1 : 0);

    Track.track('treatment_allocate', { medicine, bed, time, result: score });
    CaseSession.finishTreatment(medicine, bed, time, score);
    if (score >= 2) {
      void goState(GameState.Recovery, 'Recovery');
      return;
    }
    this.onFailed(score);
  }

  private onFailed(score: number): void {
    if (!this.hint) {
      return;
    }
    this.hint.string = `治疗评分 ${score}/3，可重试或看广告补药（占位）`;
    void this.offerRetry();
  }

  private async offerRetry(): Promise<void> {
    const result = await Ad.showRewarded('extra_medicine');
    if (this.hint) {
      this.hint.string = result.ok ? '广告奖励已到账' : '广告未就绪（占位）：直接点“开始治疗”可免费重试';
    }
  }
}
