// STATUS: implemented, W25 P1-B 听诊节奏点击（波纹与金圈重合时点击，连击决定星级）
import { _decorator, AudioSource, Component } from 'cc';
import type { CaseConfigItem } from '../config/CaseConfig';
import { AuscultationFinish, buildRhythmResult } from './AuscultationScore';
import { AuscultationRhythm, rhythmRule, RhythmGrade } from './AuscultationRhythm';
import { AuscultationRhythmView } from './AuscultationRhythmView';
import { DiagnosisHud } from './DiagnosisHud';
import { Sfx } from './Sfx';
import { Track } from '../track/Track';

const { ccclass } = _decorator;

const TOTAL_MS = 30000;

@ccclass('Auscultation')
export class Auscultation extends Component {
  private item: CaseConfigItem | null = null;
  private onFinish: AuscultationFinish | null = null;
  private rhythm: AuscultationRhythm | null = null;
  private view: AuscultationRhythmView | null = null;
  private hud: DiagnosisHud | null = null;
  private audio: AudioSource | null = null;
  private timeLeft = TOTAL_MS;
  private finished = false;

  startWith(item: CaseConfigItem, onFinish: AuscultationFinish): void {
    this.item = item;
    this.onFinish = onFinish;
    this.timeLeft = TOTAL_MS;
    this.finished = false;
    this.rhythm = new AuscultationRhythm(rhythmRule(item));
    this.audio = this.node.getComponent(AudioSource) ?? this.node.addComponent(AudioSource);
    this.hud = new DiagnosisHud(this.node, 'Auscultation', () => undefined);
    this.view = new AuscultationRhythmView(this.node, item.petId, () => this.tap());
    this.hud.paint(this.timeLeft);
    this.view.paintFrame(this.rhythm);
    Track.track('diagnosis_start', {
      caseId: item.caseId, type: 'auscultation', difficulty: item.diagnosisDifficulty,
    });
  }

  /** 广告线索：把当前这一拍按完美接上。 */
  revealHint(): void {
    const grade = this.rhythm?.autoHit() ?? null;
    if (grade) {
      this.handle(grade);
      this.view?.say('提示：这一拍已自动接住');
    }
  }

  protected update(deltaTime: number): void {
    const rhythm = this.rhythm;
    if (this.finished || !rhythm) {
      return;
    }
    this.timeLeft = Math.max(0, this.timeLeft - deltaTime * 1000);
    this.hud?.paint(this.timeLeft);
    const missed = rhythm.update(deltaTime * 1000);
    if (missed) {
      this.handle(missed);
    }
    this.view?.paintFrame(rhythm);
    if (rhythm.done) {
      this.finish(rhythm.hits >= Math.ceil(rhythm.rule.beats / 2));
      return;
    }
    if (this.timeLeft <= 0) {
      this.finish(false);
    }
  }

  private tap(): void {
    const grade = this.rhythm?.tap() ?? null;
    if (grade) {
      this.handle(grade);
    }
  }

  private handle(grade: RhythmGrade): void {
    const rhythm = this.rhythm;
    if (!rhythm || this.finished) {
      return;
    }
    this.view?.judge(grade);
    if (grade !== 'miss') {
      this.playHeartbeat();
    } else {
      Sfx.play('uiFail');
    }
    Track.track('diagnosis_action', {
      caseId: this.item?.caseId ?? '', type: 'auscultation', result: grade,
    });
  }

  private finish(completed: boolean): void {
    if (this.finished) {
      return;
    }
    this.finished = true;
    const rhythm = this.rhythm;
    if (!rhythm) {
      return;
    }
    const timeUsedMs = Math.round(TOTAL_MS - this.timeLeft);
    this.onFinish?.(buildRhythmResult(
      completed, rhythm.hits, rhythm.rule.beats, rhythm.misses, rhythm.maxCombo, timeUsedMs, TOTAL_MS,
    ));
  }

  /** W4 接入真实心跳音效：给 AudioSource 赋值 clip 后这里自动播放。 */
  private playHeartbeat(): void {
    if (this.audio && this.audio.clip) {
      this.audio.play();
    }
  }
}
