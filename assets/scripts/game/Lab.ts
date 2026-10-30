// STATUS: implemented, W4 化验小游戏（拖拽样本连试剂，错 3 次失败，04 §5）
import { _decorator, Component, Graphics } from 'cc';
import type { CaseConfigItem, CaseLabPair } from '../config/CaseConfig';
import type { AuscultationFinish } from './AuscultationScore';
import { buildResult } from './AuscultationScore';
import {
  buildColumn,
  buildDragLayer,
  drawPair,
  LabCard,
  LAB_COL_LEFT,
  LAB_COL_RIGHT,
  resolveLab,
} from './LabView';
import { LabDrag } from './LabDrag';
import { DiagnosisHud } from './DiagnosisHud';
import { mountPetAvatar } from './PetPortrait';
import { PALETTE } from '../ui/SceneUI';
import { Track } from '../track/Track';

const { ccclass } = _decorator;

const MAX_MISTAKES = 3;
const TOTAL_MS = 30000;

@ccclass('Lab')
export class Lab extends Component {
  private item: CaseConfigItem | null = null;
  private onFinish: AuscultationFinish | null = null;
  private samples: LabCard[] = [];
  private reagents: LabCard[] = [];
  private pairs: CaseLabPair[] = [];
  private dragLayer: Graphics | null = null;
  private hud: DiagnosisHud | null = null;
  private mistakes = 0;
  private timeLeft = TOTAL_MS;
  private finished = false;
  private drag: LabDrag | null = null;

  startWith(item: CaseConfigItem, onFinish: AuscultationFinish, setHint?: (text: string) => void): void {
    this.item = item;
    this.onFinish = onFinish;
    const plan = resolveLab(item);
    this.pairs = plan.pairs;
    const root = this.node;
    this.hud = new DiagnosisHud(root, 'Lab', setHint ?? (() => undefined));
    // 左右两列卡片各贴边 200 宽，中间 260 宽的通道始终空着：宠物放这里，不挡拖拽判定。
    mountPetAvatar(root, item.petId, 0, -20, 150);
    this.dragLayer = buildDragLayer(root);
    this.reagents = buildColumn(root, plan.reagents, LAB_COL_RIGHT, PALETTE.accent, 'Reagent');
    this.samples = buildColumn(
      root,
      plan.pairs.map((pair) => pair.sample),
      LAB_COL_LEFT,
      PALETTE.secondary,
      'Sample',
    );
    this.drag = new LabDrag({
      active: () => !this.finished,
      layer: () => this.dragLayer,
      reagents: () => this.reagents,
      expected: (sample) => this.expected(sample),
      onMatch: (sample, reagent) => this.connect(sample, reagent),
      onMiss: (sample, reagent) => this.mismatch(sample, reagent),
      onEmpty: () => this.hud?.setHint('把样本拖到右侧对应的试剂上'),
      onHint: (text) => this.hud?.setHint(text),
    });
    this.samples.forEach((card) => this.drag!.bind(card));
    this.hud.paint(this.timeLeft);
    Track.track('diagnosis_start', { caseId: item.caseId, type: 'lab', difficulty: item.diagnosisDifficulty });
  }

  /** 广告提示：自动匹配一组尚未连线的样本。 */
  revealHint(): void {
    const sample = this.samples.find((card) => !card.matched);
    const reagent = sample
      ? this.reagents.find((card) => !card.matched && card.name === this.expected(sample.name))
      : undefined;
    if (!sample || !reagent || this.finished) {
      return;
    }
    this.connect(sample, reagent);
    this.hud?.setHint('已自动匹配一组');
  }

  protected update(deltaTime: number): void {
    if (this.finished) {
      return;
    }
    this.timeLeft = Math.max(0, this.timeLeft - deltaTime * 1000);
    this.hud?.paint(this.timeLeft);
    if (this.timeLeft <= 0) {
      this.finish(false);
    }
  }

  private mismatch(sample: LabCard, reagent: LabCard): void {
    this.mistakes += 1;
    this.trackAction(sample, reagent, 'miss');
    this.hud?.setHint('这个试剂不匹配，再看看颜色');
    if (this.mistakes >= MAX_MISTAKES) {
      this.finish(false);
    }
  }

  private connect(sample: LabCard, reagent: LabCard): void {
    sample.matched = true;
    reagent.matched = true;
    this.trackAction(sample, reagent, 'hit');
    drawPair(this.node, sample.node.getWorldPosition(), reagent.node.getWorldPosition());
    if (this.samples.every((card) => card.matched)) {
      this.finish(true);
    }
  }

  private trackAction(sample: LabCard, reagent: LabCard, result: 'hit' | 'miss'): void {
    Track.track('diagnosis_action', {
      caseId: this.item?.caseId ?? '',
      type: 'lab',
      sample: sample.name,
      reagent: reagent.name,
      result,
    });
  }

  private expected(sample: string): string {
    const pair = this.pairs.find((entry) => entry.sample === sample);
    return pair ? pair.reagent : '';
  }

  private finish(completed: boolean): void {
    if (this.finished) {
      return;
    }
    this.finished = true;
    this.hud?.setHint(completed ? '匹配上了，指标很清楚。' : '别急，可以重试或看广告获得提示。');
    const found = this.samples.filter((card) => card.matched).length;
    const timeUsedMs = Math.round(TOTAL_MS - this.timeLeft);
    this.onFinish?.(buildResult(completed, found, this.samples.length, this.mistakes, timeUsedMs, TOTAL_MS));
  }
}
