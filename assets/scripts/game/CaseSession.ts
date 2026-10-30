// STATUS: implemented, W5 单局会话（病例上下文 + 评分收集 + 上报快照）
import type { CaseConfigItem } from '../config/CaseConfig';
import type { CaseSyncInput } from '../net/SyncCaseResult';
import { Save } from '../cache/Save';
import { Hospital } from './Hospital';
import { Track } from '../track/Track';
import { buildCaseSync } from './CloudPayload';
import { newSessionId } from './SessionId';
import { trackDiagnosis, trackRecovery, trackTreatment } from './CaseTrack';
import { affectionGain, recoverySeconds, recoveryStars, treatmentStars } from './CaseScore';
import { CaseReward, DiagnosisResult, RecoveryResult, TreatmentResult, emptyReward, settleCase, trackCaseComplete } from './CaseSettle';

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
  private sid = '';
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
    this.sid = newSessionId();
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
    trackDiagnosis(this.item ? this.item.caseId : '', this.diagnosis);
  }

  finishTreatment(medicine: string, bed: string, time: string, score: number): void {
    const success = treatmentStars(score) > 0;
    this.treatment = { medicine, bed, time, score, success };
    trackTreatment(this.item ? this.item.caseId : '', this.treatment);
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
    trackRecovery(item.caseId, this.recovery);
  }

  /** 领养成功：本地图鉴落库并记录领养日期，结算时按已领养处理。 */
  markAdopted(petId: string): void {
    this.adopted = true;
    Save.markAdopted(petId);
    Track.track('adoption_complete', {
      caseId: this.item ? this.item.caseId : '',
      petId,
    });
  }

  /** Result 结算后调用：服务端会按 diagnosis/treatment 重算星级与奖励。 */
  report(durationMs: number): CaseSyncInput | null {
    const item = this.item;
    const treatment = this.treatment;
    if (!item || !treatment) {
      return null;
    }
    const { diagnosis } = this;
    return buildCaseSync({ sessionId: this.sid, item, diagnosis, treatment, durationMs });
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
