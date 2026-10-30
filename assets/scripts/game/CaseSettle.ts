// STATUS: implemented, W3 单局结算（星级合成 + 发奖 + 埋点）
import type { CaseConfigItem } from '../config/CaseConfig';
import { Save } from '../cache/Save';
import { Hospital } from './Hospital';
import { Track } from '../track/Track';
import { rewardAmounts, totalStars, treatmentStars } from './CaseScore';

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

export interface RecoveryResult {
  elapsedMs: number;
  totalMs: number;
  stars: number;
}

export interface CaseReward {
  stars: number;
  diagnosisStars: number;
  treatmentScore: number;
  recoveryStars: number;
  coins: number;
  hearts: number;
  affection: number;
  firstClear: boolean;
  adopted: boolean;
  durationMs: number;
}

export interface SettleInput {
  item: CaseConfigItem;
  diagnosis: DiagnosisResult | null;
  treatment: TreatmentResult;
  recovery: RecoveryResult | null;
  affection: number;
  adopted: boolean;
  durationMs: number;
}

export function emptyReward(adopted: boolean, durationMs: number): CaseReward {
  return {
    stars: 0, diagnosisStars: 0, treatmentScore: 0, recoveryStars: 0,
    coins: 0, hearts: 0, affection: 0, firstClear: false, adopted, durationMs,
  };
}

export function settleCase(input: SettleInput): CaseReward {
  const { item, treatment } = input;
  const diagnosisStars = input.diagnosis ? input.diagnosis.stars : 0;
  const recovery = input.recovery ? input.recovery.stars : 1;
  const stars = totalStars(diagnosisStars, treatmentStars(treatment.score, item.severity), recovery);
  const firstClear = Save.recordStars(item.caseId, stars);
  const amounts = rewardAmounts(item.baseRewards, stars, firstClear);
  Save.addCoins(amounts.coins);
  Save.addHearts(amounts.hearts);
  if (treatment.bed === '住院') {
    Hospital.freeBed();
  }
  return {
    stars, diagnosisStars, treatmentScore: treatment.score, recoveryStars: recovery,
    coins: amounts.coins, hearts: amounts.hearts, affection: input.affection,
    firstClear, adopted: input.adopted, durationMs: input.durationMs,
  };
}

export function trackCaseComplete(item: CaseConfigItem | null, reward: CaseReward): void {
  Track.track('case_complete', {
    caseId: item ? item.caseId : '',
    petId: item ? item.petId : '',
    stars: reward.stars,
    diagnosisStars: reward.diagnosisStars,
    treatmentScore: reward.treatmentScore,
    recoveryStars: reward.recoveryStars,
    coins: reward.coins,
    hearts: reward.hearts,
    affection: reward.affection,
    adopted: reward.adopted,
    firstClear: reward.firstClear,
    duration: reward.durationMs,
  });
}
