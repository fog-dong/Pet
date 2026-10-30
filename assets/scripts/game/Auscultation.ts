// STATUS: implemented, W3 听诊小游戏（30 秒点击找异常点 + 1-3 星判定）
import { _decorator, AudioSource, Component, Label } from 'cc';
import type { CaseConfigItem } from '../config/CaseConfig';
import { AuscultationLayout, buildLayout } from '../config/AuscultationConfig';
import { Quality } from '../config/Quality';
import { addLabel, PALETTE } from '../ui/SceneUI';
import { rightEdgeX } from '../ui/ScreenMetrics';
import { AuscultationView, SpotView } from './AuscultationView';
import { DIAGNOSIS_HUD_Y } from './DiagnosisLayout';
import { AuscultationFinish, buildResult } from './AuscultationScore';
import { Track } from '../track/Track';

const { ccclass } = _decorator;

@ccclass('Auscultation')
export class Auscultation extends Component {
  private view: AuscultationView | null = null;
  private layout: AuscultationLayout | null = null;
  private item: CaseConfigItem | null = null;
  private onFinish: AuscultationFinish | null = null;
  private timerLabel: Label | null = null;
  private audio: AudioSource | null = null;
  private timeLeft = 0;
  private found = 0;
  private mistakes = 0;
  private lastSecond = -1;
  private running = false;
  private finished = false;
  private unsubscribe: (() => void) | null = null;

  protected onEnable(): void {
    this.unsubscribe = Quality.subscribe(() => this.view?.applyQuality());
  }

  protected onDisable(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  startWith(item: CaseConfigItem, onFinish: AuscultationFinish): void {
    this.item = item;
    this.onFinish = onFinish;
    const layout = buildLayout(item);
    this.layout = layout;
    this.timeLeft = layout.totalMs;
    this.found = 0;
    this.mistakes = 0;
    this.lastSecond = -1;
    this.finished = false;
    this.running = true;
    this.audio = this.node.getComponent(AudioSource) ?? this.node.addComponent(AudioSource);

    this.view = new AuscultationView(this.node, item.petId, layout, (spot) => this.onTap(spot));
    this.timerLabel = addLabel(this.node, 'TimerLabel', '', DIAGNOSIS_HUD_Y, {
      size: 28,
      color: PALETTE.primary,
      x: rightEdgeX(150),
    });
    this.paintTimer(Math.ceil(this.timeLeft / 1000));
    this.paintProgress();
    Track.track('diagnosis_start', { caseId: item.caseId, type: 'auscultation', difficulty: item.diagnosisDifficulty });
  }

  /** 广告线索：点亮一个还没找到的异常点。 */
  revealHint(): void {
    const spot = this.view?.spots.find((item) => item.abnormal && !item.resolved);
    if (spot) {
      this.view?.revealHint(spot);
    }
  }

  protected update(deltaTime: number): void {
    if (!this.running) {
      return;
    }
    this.timeLeft = Math.max(0, this.timeLeft - deltaTime * 1000);
    const seconds = Math.ceil(this.timeLeft / 1000);
    if (seconds !== this.lastSecond) {
      this.lastSecond = seconds;
      this.paintTimer(seconds);
    }
    if (this.timeLeft <= 0) {
      this.finish(false);
    }
  }

  private onTap(spot: SpotView): void {
    const item = this.item;
    const layout = this.layout;
    if (!this.running || !item || !layout) {
      return;
    }
    if (spot.abnormal) {
      this.found += 1;
      this.view?.markFound(spot);
      this.playHeartbeat();
      this.paintProgress();
      Track.track('diagnosis_action', { caseId: item.caseId, spot: spot.def.id, result: 'hit' });
      if (this.found >= layout.abnormal.length) {
        this.finish(true);
      }
      return;
    }
    this.mistakes += 1;
    this.timeLeft = Math.max(0, this.timeLeft - layout.mistakePenaltyMs);
    this.view?.markWrong(spot);
    this.paintProgress();
    Track.track('diagnosis_action', { caseId: item.caseId, spot: spot.def.id, result: 'miss' });
    if (this.mistakes >= layout.maxMistakes) {
      this.finish(false);
    }
  }

  private finish(completed: boolean): void {
    if (this.finished) {
      return;
    }
    this.finished = true;
    this.running = false;
    const layout = this.layout;
    if (!layout) {
      return;
    }
    const timeUsedMs = Math.round(layout.totalMs - this.timeLeft);
    this.onFinish?.(buildResult(completed, this.found, layout.abnormal.length, this.mistakes, timeUsedMs, layout.totalMs));
  }

  private paintTimer(seconds: number): void {
    if (this.timerLabel) {
      this.timerLabel.string = `剩余 ${Math.max(0, seconds)}s`;
    }
  }

  private paintProgress(): void {
    const total = this.layout ? this.layout.abnormal.length : 0;
    this.view?.setProgress(`已发现 ${this.found}/${total}　误诊 ${this.mistakes}`);
  }

  /** W4 接入真实心跳音效：给 AudioSource 赋值 clip 后这里自动播放。 */
  private playHeartbeat(): void {
    if (this.audio && this.audio.clip) {
      this.audio.play();
    }
  }
}
