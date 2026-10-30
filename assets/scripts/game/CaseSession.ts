// STATUS: implemented, W3 单局会话（病例上下文 + 结算）
import type { CaseConfigItem } from '../config/CaseConfig';
import { Save } from '../cache/Save';
import { Track } from '../track/Track';

export interface DiagnosisResult {
  stars: number;
  mistakes: number;
  durationMs: number;
  retryCount: number;
}

export interface TreatmentResult {
  medicine: string;
  bed: string;
  time: string;
  score: number;
  success: boolean;
}

export interface CaseReward {
  stars: number;
  coins: number;
  hearts: number;
  affection: number;
  firstClear: boolean;
  durationMs: number;
}

const STAR_RATE = [0, 0.5, 0.8, 1];

function newSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export class CaseSessionStore {
  private item: CaseConfigItem | null = null;
  private sessionId = '';
  private startedAt = 0;
  private diagnosisStartedAt = 0;
  private diagnosis: DiagnosisResult | null = null;
  private treatment: TreatmentResult | null = null;
  private reward: CaseReward | null = null;
  private retryCount = 0;
  adopted = false;

  get current(): CaseConfigItem | null {
    return this.item;
  }

  get caseSessionId(): string {
    return this.sessionId;
  }

  get diagnosisDurationMs(): number {
    return this.diagnosisStartedAt > 0 ? Date.now() - this.diagnosisStartedAt : 0;
  }

  start(item: CaseConfigItem): void {
    this.item = item;
    this.sessionId = newSessionId();
    this.startedAt = Date.now();
    this.diagnosisStartedAt = 0;
    this.diagnosis = null;
    this.treatment = null;
    this.reward = null;
    this.retryCount = 0;
    this.adopted = false;
    Save.load();
    Save.markSeen(item.petId);
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
    const item = this.item;
    Track.track('diagnosis_result', {
      caseId: item ? item.caseId : '',
      stars,
      mistakes,
      timeUsed: durationMs,
      duration: durationMs,
      retryCount: this.retryCount,
    });
  }

  finishTreatment(medicine: string, bed: string, time: string, score: number): void {
    const success = score >= 2;
    this.treatment = { medicine, bed, time, score, success };
    const item = this.item;
    Track.track('treatment_result', {
      caseId: item ? item.caseId : '',
      success,
      score,
      duration: this.startedAt > 0 ? Date.now() - this.startedAt : 0,
    });
  }

  /** 进入 Result 前调用一次，重复调用返回同一份结算，保证幂等。 */
  settle(): CaseReward {
    if (this.reward) {
      return this.reward;
    }
    const item = this.item;
    const empty: CaseReward = {
      stars: 0,
      coins: 0,
      hearts: 0,
      affection: 0,
      firstClear: false,
      durationMs: this.startedAt > 0 ? Date.now() - this.startedAt : 0,
    };
    if (!item || !this.treatment || !this.treatment.success) {
      this.reward = empty;
      this.trackResult(item ? item.caseId : '', empty);
      return this.reward;
    }

    const diagnosisStars = this.diagnosis ? this.diagnosis.stars : 0;
    const treatmentStars = this.treatment.score >= 3 ? 3 : 2;
    const stars = Math.max(1, Math.min(diagnosisStars, treatmentStars));
    const rate = STAR_RATE[stars] ?? 0.5;
    const base = item.baseRewards;
    const firstClear = Save.recordStars(item.caseId, stars);
    const coins = Math.round(base.coins * rate * (firstClear ? 1.5 : 1));
    const hearts = Math.round(base.hearts * rate);
    Save.addCoins(coins);
    Save.addHearts(hearts);

    this.reward = {
      stars,
      coins,
      hearts,
      affection: base.affection,
      firstClear,
      durationMs: empty.durationMs,
    };
    this.trackResult(item.caseId, this.reward);
    return this.reward;
  }

  private trackResult(caseId: string, reward: CaseReward): void {
    Track.track('case_result', {
      caseId,
      stars: reward.stars,
      coins: reward.coins,
      hearts: reward.hearts,
      duration: reward.durationMs,
    });
  }
}

export const CaseSession = new CaseSessionStore();
