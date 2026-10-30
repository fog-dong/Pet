// STATUS: implemented, W4 诊断调度（听诊/拍片/化验，最多 2 个，共用评分入口）
import { _decorator, Button, Component, Label, Node, UITransform } from 'cc';
import type { CaseConfigItem } from '../config/CaseConfig';
import { CaseSession } from './CaseSession';
import type { AuscultationResult } from './AuscultationScore';
import { combineDiagnosis, emptyOutcome } from './DiagnosisScore';
import { DiagnosisKind, diagnosisSequence } from './DiagnosisSequence';
import { buildDiagnosisLayout, DIAGNOSIS_HINT, DIAGNOSIS_NAME } from './DiagnosisLayout';
import { buildInspection, refreshInspection, watchInspection } from './DiagnosisInspection';
import { Hintable, spawnDiagnosis } from './DiagnosisGames';
import { DiagnosisFallback } from './DiagnosisFallback';
import { GameState } from '../core/GameFSM';
import { goState } from '../core/SceneFlow';
import { Save } from '../cache/Save';
import { Track } from '../track/Track';
import { ChoicePanel } from '../ui/ChoicePanel';
import { screenHeight, screenWidth } from '../ui/ScreenMetrics';

const { ccclass } = _decorator;

@ccclass('Diagnosis')
export class Diagnosis extends Component {
  private item: CaseConfigItem | null = null;
  private kinds: DiagnosisKind[] = [];
  private outcomes: AuscultationResult[] = [];
  private index = 0;
  private forceLow = false;
  private gameRoot: Node | null = null;
  private game: Hintable | null = null;
  private hint: Label | null = null;
  private step: Label | null = null;
  private inspection: Button | null = null;
  private readonly panel = new ChoicePanel();
  private readonly fallback = new DiagnosisFallback(
    {
      root: () => this.node,
      retry: (withHint) => this.retry(withHint),
      useBattery: () => this.useBattery(),
      status: (text) => this.setHint(text),
    },
    this.panel,
  );

  protected start(): void {
    const item = CaseSession.current;
    if (!item) {
      void goState(GameState.Lobby, 'Lobby');
      return;
    }
    this.item = item;
    this.kinds = diagnosisSequence(item);
    CaseSession.beginDiagnosis();
    const layout = buildDiagnosisLayout(this.node, item.petName, item.breed);
    this.hint = layout.hint;
    this.step = layout.step;
    this.inspection = buildInspection(this.node, () => void this.onInspection());
    refreshInspection(this.inspection);
    this.startGame(0);
  }

  private startGame(index: number): void {
    const item = this.item;
    if (!item) {
      return;
    }
    this.panel.close();
    this.gameRoot?.destroy();
    const root = new Node('DiagnosisGame');
    root.parent = this.node;
    root.setSiblingIndex(0);
    root.addComponent(UITransform).setContentSize(screenWidth(), screenHeight());
    this.gameRoot = root;
    this.index = index;
    const kind = this.kinds[index];
    this.game = spawnDiagnosis(
      root,
      kind,
      item,
      (result) => this.onGameFinished(index, result),
      (text) => this.setHint(text),
    );
    this.paintStep();
    this.setHint(`${DIAGNOSIS_NAME[kind]}：${DIAGNOSIS_HINT[kind]}`);
  }

  private paintStep(): void {
    if (this.step) {
      this.step.string = this.kinds.length > 1 ? `诊断 ${this.index + 1}/${this.kinds.length}` : '';
    }
  }

  private onGameFinished(index: number, result: AuscultationResult): void {
    this.outcomes[index] = result;
    if (!result.completed) {
      this.setHint('这一次没查完，可以重试、看广告拿提示，或用电池跳过。');
      this.fallback.open();
      return;
    }
    if (index + 1 < this.kinds.length) {
      this.startGame(index + 1);
      return;
    }
    this.finishDiagnosis();
  }

  private finishDiagnosis(): void {
    const merged = combineDiagnosis(this.outcomes);
    const stars = this.forceLow ? Math.min(1, merged.stars) : merged.stars;
    CaseSession.finishDiagnosis(stars, merged.mistakes, merged.timeUsedMs);
    this.setHint('诊断明确，准备治疗。');
    void goState(GameState.Treatment, 'Treatment');
  }

  private retry(withHint: boolean): void {
    CaseSession.addRetry();
    this.startGame(this.index);
    if (withHint) {
      this.game?.revealHint();
    }
    this.setHint(withHint ? '已给出提示，继续吧' : '已重置，重新开始');
  }

  private useBattery(): void {
    if (!Save.useItem('battery')) {
      this.setHint('听诊器电池不足，可以直接重试');
      return;
    }
    this.panel.close();
    Track.track('diagnosis_item_skip', {
      caseId: this.item ? this.item.caseId : '',
      type: this.kinds[this.index],
    });
    this.forceLow = true;
    this.outcomes[this.index] = emptyOutcome(true);
    if (this.index + 1 < this.kinds.length) {
      this.startGame(this.index + 1);
      return;
    }
    this.finishDiagnosis();
  }

  private async onInspection(): Promise<void> {
    await watchInspection(this.inspection, () => this.game?.revealHint(), (text) => this.setHint(text));
  }

  private setHint(text: string): void {
    if (this.hint) {
      this.hint.string = text;
    }
  }

  protected onDestroy(): void {
    this.panel.close();
  }
}
