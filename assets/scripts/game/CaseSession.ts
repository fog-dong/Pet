// STATUS: implemented, W3 单局会话（病例上下文 + 评分收集 + 结算委托）
import type { CaseConfigItem } from '../config/CaseConfig';
import { Save } from '../cache/Save';
import { Hospital } from './Hospital';
import { Track } from '../track/Track';
import { affectionGain, recoverySeconds, recoveryStars, treatmentStars } from './CaseScore';
import {
  CaseReward,
  DiagnosisResult,
  RecoveryResult,
  TreatmentResult,
  emptyReward,
  settleCase,
  trackCaseComplete,
} from './CaseSettle';

export class CaseSessionStore {
  private item: CaseConfigItem | null = null;
  private startedAt = 0;
  private diagnosisStartedAt = 0;
  private diagnosis: DiagnosisResult | null = null;
  private treatment: TreatmentResult | null = null;
  private recovery: RecoveryResult | null = null;
  private reward: CaseReward | null = null;
  private retryCount = 0;
  private affection = 0;
  adopted = false;

  get current(): CaseConfigItem | null {
    return this.item;
  }

  get diagnosisDurationMs(): number {
    return this.diagnosisStartedAt > 0 ? Date.now() - this.diagnosisStartedAt : 0;
  }

  /** 康复时长由治疗阶段的时间选择决定（正常 14 秒 / 加速 9 秒）。 */
  get plannedRecoverySeconds(): number {
    return this.treatment ? recoverySeconds(this.treatment.time) : recoverySeconds('正常');
  }

  start(item: CaseConfigItem): void {
    this.item = item;
    this.startedAt = Date.now();
    this.diagnosisStartedAt = 0;
    this.diagnosis = null;
    this.treatment = null;
    this.recovery = null;
    this.reward = null;
    this.retryCount = 0;
    this.affection = 0;
    this.adopted = false;
    Save.load();
    Save.markSeen(item.petId);
    Hospital.seedMedicines(item.treatment.medicine);
    Hospital.resetBeds();
    Track.track('case_start', {
      caseId: item.caseId,
      petId: item.petId,
      difficulty: item.diagnosisDifficulty,
      source: 'lobby',
    });
  }

  beginDiagnosis(): void {
    this.diagnosisStartedAt = Date.now();
  }

  addRetry(): void {
    this.retryCount += 1;
  }

  finishDiagnosis(stars: number, mistakes: number, timeUsedMs = 0): void {
    const durationMs = timeUsedMs > 0 ? timeUsedMs : this.diagnosisDurationMs;
    this.diagnosis = { stars, mistakes, durationMs, retryCount: this.retryCount };
    Track.track('diagnosis_result', {
      caseId: this.item ? this.item.caseId : '',
      stars,
      mistakes,
      timeUsed: durationMs,
      duration: durationMs,
      retryCount: this.retryCount,
    });
  }

  finishTreatment(medicine: string, bed: string, time: string, score: number): void {
    const success = treatmentStars(score) > 0;
    this.treatment = { medicine, bed, time, score, success };
    Track.track('treatment_result', {
      caseId: this.item ? this.item.caseId : '',
      success,
      score,
      bed,
      medicine,
    });
  }

  /** 康复结束即结算好感度，领养页据此判断门槛。 */
  finishRecovery(elapsedMs: number, totalMs: number): void {
    const stars = recoveryStars(elapsedMs, totalMs);
    this.recovery = { elapsedMs, totalMs, stars };
    const item = this.item;
    if (!item) {
      return;
    }
    const score = this.treatment ? this.treatment.score : 0;
    this.affection = affectionGain(item.baseRewards.affection, score, stars);
    Hospital.addAffection(item.petId, this.affection);
    Track.track('recovery_result', {
      caseId: item.caseId,
      stars,
      elapsed: elapsedMs,
      total: totalMs,
    });
  }

  /** 进入 Result 前调用一次，重复调用返回同一份结算，保证幂等。 */
  settle(): CaseReward {
    if (this.reward) {
      return this.reward;
    }
    const durationMs = this.startedAt > 0 ? Date.now() - this.startedAt : 0;
    const item = this.item;
    const treatment = this.treatment;
    if (!item || !treatment || !treatment.success) {
      this.reward = emptyReward(this.adopted, durationMs);
    } else {
      this.reward = settleCase({
        item,
        diagnosis: this.diagnosis,
        treatment,
        recovery: this.recovery,
        affection: this.affection,
        adopted: this.adopted,
        durationMs,
      });
    }
    trackCaseComplete(item, this.reward);
    return this.reward;
  }
}

export const CaseSession = new CaseSessionStore();
