// STATUS: implemented, W25 P2 负反馈与口碑兜底表（与 penalty.json 逐项同值，只在整份配置读不到时启用）
import type { CrisisRules, DiagnosisRules, ReputationRules, TreatmentRules } from './PenaltyConfig';

/** 同 AgeSystem.DEFAULT_LIFESPAN 口径：缺配回落并 Track 告警，不静默。 */
export const PENALTY_FALLBACK = {
  diagnosis: {
    warnMistakes: 2,
    escalateMistakes: 3,
    affectionPenalty: 8,
    harshAffectionPenalty: 15,
  } as DiagnosisRules,
  treatment: {
    wrongMedicineAffectionPenalty: 5,
    wrongMedicineMoodPenalty: 20,
    recoveryTimeMultiplier: 2,
    retryLimit: 3,
  } as TreatmentRules,
  crisis: {
    countdownSeconds: 180,
    scope: ['Diagnosis', 'Treatment'],
    pauseOnHide: true,
    refundRatio: 0.5,
    heartsPenalty: 2,
  } as CrisisRules,
  reputation: {
    gainPerStar: 1,
    transferPenalty: 1,
  } as ReputationRules,
  severityOrder: ['normal', 'urgent', 'critical'],
};
