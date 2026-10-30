// STATUS: implemented, W3 听诊小游戏（30 秒点击找异常点 + 1-3 星判定）
import { _decorator, AudioSource, Color, Component, Label } from 'cc';
import type { CaseConfigItem } from '../config/CaseConfig';
import { AuscultationLayout, buildLayout } from '../config/AuscultationConfig';
import { CharacterConfig } from '../config/CharacterConfig';
import { addLabel, hexToColor, PALETTE } from '../ui/SceneUI';
import { AuscultationView, SpotView } from './AuscultationView';
import { AuscultationFinish, judgeStars } from './AuscultationScore';
import { Track } from '../track/Track';

const { ccclass } = _decorator;
const FALLBACK_BODY = new Color(200, 195, 188, 255);

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

    const pet = CharacterConfig.petById(item.petId);
    const bodyColor = pet ? hexToColor(pet.colors.sick, FALLBACK_BODY) : FALLBACK_BODY;
    this.view = new AuscultationView(this.node, bodyColor, layout, (spot) => this.onTap(spot));
    this.timerLabel = addLabel(this.node, 'TimerLabel', '', 330, {
      size: 28,
      color: PALETTE.primary,
      x: 440,
    });
    this.paintTimer(Math.ceil(this.timeLeft / 1000));
    this.paintProgress();
    Track.track('diagnosis_start', {
      caseId: item.caseId,
      type: 'auscultation',
      difficulty: item.diagnosisDifficulty,
    });
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
    const stars = completed ? judgeStars(this.mistakes, timeUsedMs, layout.totalMs) : 0;
    this.onFinish?.({
      completed,
      stars,
      found: this.found,
      total: layout.abnormal.length,
      mistakes: this.mistakes,
      timeUsedMs,
      totalMs: layout.totalMs,
    });
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
