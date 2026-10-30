// STATUS: implemented, W12-3 syncCaseResult 共享类型（接口口径见 docs/plan/接口冻结清单.md §2.4）
export interface RewardConfig {
  coins: number;
  hearts: number;
  affection: number;
}

export interface RewardAmounts {
  coins: number;
  hearts: number;
}

export interface CaseConfigItem {
  caseId: string;
  petSpecies?: string;
  petName?: string;
  severity?: string;
  treatment?: { correct?: { medicine?: string; bed?: string; time?: string } };
  baseRewards: RewardConfig;
}

export interface DiagnosisInput {
  type: 'auscultation' | 'xray' | 'lab';
  stars: number;
  mistakes: number;
  durationMs: number;
}

export interface TreatmentInput {
  result: 'success' | 'partial' | 'fail';
  medicineUsed: string[];
  bedUsed: boolean;
  healing: number;
}

export interface ComputedCase {
  stars: number;
  diagnosisStars: number;
  treatmentScore: number;
  treatmentStars: number;
  recoveryStars: number;
  status: 'succeeded' | 'partial' | 'failed';
  affection: number;
}

export interface CaseResultSummary {
  caseId: string;
  status: 'succeeded' | 'partial' | 'failed';
  stars: number;
  diagnosisStars: number;
  treatmentStars: number;
  recoveryStars: number;
  firstClear: boolean;
  durationMs: number;
  finishedAt: number;
}

export interface CaseRewards {
  coins: number;
  hearts: number;
  reputation: number;
  affection: number;
}

export interface SettleOutcome {
  replayed: boolean;
  result: CaseResultSummary;
  rewards: CaseRewards;
  resources: Record<string, unknown>;
}

export interface SettleInput {
  openid: string;
  caseSessionId: string;
  caseId: string;
  diagnosis: DiagnosisInput;
  treatment: TreatmentInput;
  durationMs: number;
  item: CaseConfigItem;
  now: number;
}
