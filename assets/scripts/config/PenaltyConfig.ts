// STATUS: implemented, W25 P2-A 负反馈数值配置（penalty.json 为唯一口径，改数值不必动代码）
import { loadConfigJson } from './ConfigLoader';

export interface DiagnosisRules {
  /** 达到该失误数开始扣好感度。 */
  warnMistakes: number;
  /** 达到该失误数按重罚档扣，并由 P2-A2 触发病情恶化。 */
  escalateMistakes: number;
  affectionPenalty: number;
  harshAffectionPenalty: number;
}

export interface TreatmentRules {
  wrongMedicineAffectionPenalty: number;
  wrongMedicineMoodPenalty: number;
  /** 用错药的惩罚不止掉心情：康复时长按倍数拉长。 */
  recoveryTimeMultiplier: number;
}

interface PenaltyFile {
  version: number;
  diagnosis?: Partial<DiagnosisRules>;
  treatment?: Partial<TreatmentRules>;
}

/** 兜底表与 penalty.json 保持一致；仅在整份配置读不到时启用（同 AgeSystem.DEFAULT_LIFESPAN 口径）。 */
const FALLBACK = {
  diagnosis: {
    warnMistakes: 2,
    escalateMistakes: 3,
    affectionPenalty: 8,
    harshAffectionPenalty: 15,
  },
  treatment: {
    wrongMedicineAffectionPenalty: 5,
    wrongMedicineMoodPenalty: 20,
    recoveryTimeMultiplier: 2,
  },
};

class PenaltyConfigStore {
  private diagnosisRules: DiagnosisRules = FALLBACK.diagnosis;
  private treatmentRules: TreatmentRules = FALLBACK.treatment;
  private loaded = false;

  get diagnosis(): DiagnosisRules {
    return this.diagnosisRules;
  }

  get treatment(): TreatmentRules {
    return this.treatmentRules;
  }

  async load(): Promise<boolean> {
    if (this.loaded) {
      return true;
    }
    const file = await loadConfigJson<PenaltyFile>('config/penalty');
    if (!file) {
      return false;
    }
    this.diagnosisRules = {
      warnMistakes: intOf(file.diagnosis?.warnMistakes, FALLBACK.diagnosis.warnMistakes, 1),
      escalateMistakes: intOf(file.diagnosis?.escalateMistakes, FALLBACK.diagnosis.escalateMistakes, 1),
      affectionPenalty: intOf(file.diagnosis?.affectionPenalty, FALLBACK.diagnosis.affectionPenalty),
      harshAffectionPenalty: intOf(file.diagnosis?.harshAffectionPenalty, FALLBACK.diagnosis.harshAffectionPenalty),
    };
    this.treatmentRules = {
      wrongMedicineAffectionPenalty: intOf(
        file.treatment?.wrongMedicineAffectionPenalty,
        FALLBACK.treatment.wrongMedicineAffectionPenalty,
      ),
      wrongMedicineMoodPenalty: intOf(file.treatment?.wrongMedicineMoodPenalty, FALLBACK.treatment.wrongMedicineMoodPenalty),
      recoveryTimeMultiplier: intOf(file.treatment?.recoveryTimeMultiplier, FALLBACK.treatment.recoveryTimeMultiplier, 1),
    };
    this.loaded = true;
    return true;
  }
}

/** 配置里的负数或非法值一律回到兜底，避免一个错字把惩罚算成收益。 */
function intOf(value: number | undefined, fallback: number, min = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.round(value));
}

export const PenaltyConfig = new PenaltyConfigStore();
