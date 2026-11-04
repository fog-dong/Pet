// STATUS: implemented, W25 P2-A 负反馈数值配置（penalty.json 为唯一口径，改数值不必动代码）
import { loadConfigJson } from './ConfigLoader';
// 兜底表与 penalty.json 逐项同值，拆到 PenaltyDefaults 只为把本文件压在 150 行红线内。
import { PENALTY_FALLBACK as FALLBACK } from './PenaltyDefaults';

export interface DiagnosisRules {
  /** 达到该失误数开始扣好感度。 */
  warnMistakes: number;
  /** 达到该失误数按重罚档扣，并把危急度上调一档。 */
  escalateMistakes: number;
  affectionPenalty: number;
  harshAffectionPenalty: number;
}

export interface TreatmentRules {
  wrongMedicineAffectionPenalty: number;
  wrongMedicineMoodPenalty: number;
  /** 用错药的惩罚不止掉心情：康复时长按倍数拉长。 */
  recoveryTimeMultiplier: number;
  /** 同一局第 N 次治疗仍不达标即视为重试用尽，转入危重倒计时。 */
  retryLimit: number;
}

export interface CrisisRules {
  /** 危机留给「开对药」的决策窗口；康复页不再计时，避免治完了干等。 */
  countdownSeconds: number;
  /** 允许启动倒计时的状态，取值与 core/GameFSM.GameState 同名。 */
  scope: readonly string[];
  /** 切后台/锁屏暂停：接个电话回来宠物被转院是必被差评的设计。 */
  pauseOnHide: boolean;
  /** 转院时按此比例退回本局已消耗药品，每种向下取整。 */
  refundRatio: number;
  /** 唯一的硬资源损失，量级对齐一局普通病例的进账。 */
  heartsPenalty: number;
}

interface PenaltyFile {
  version: number;
  diagnosis?: Partial<DiagnosisRules>;
  treatment?: Partial<TreatmentRules>;
  crisis?: Partial<CrisisRules>;
  severityOrder?: string[];
}

/** 读一次、全本地兜底；缺配由 Boot 记 boot_penalty_missing 告警。 */
class PenaltyConfigStore {
  private diagnosisRules: DiagnosisRules = FALLBACK.diagnosis;
  private treatmentRules: TreatmentRules = FALLBACK.treatment;
  private crisisRules: CrisisRules = FALLBACK.crisis;
  private severityOrder: readonly string[] = FALLBACK.severityOrder;
  private loaded = false;

  get diagnosis(): DiagnosisRules {
    return this.diagnosisRules;
  }

  get treatment(): TreatmentRules {
    return this.treatmentRules;
  }

  get crisis(): CrisisRules {
    return this.crisisRules;
  }

  /** 危急度档位顺序，病情恶化按它上调一档；不在表里的危急度视为首档。 */
  get severities(): readonly string[] {
    return this.severityOrder;
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
      retryLimit: intOf(file.treatment?.retryLimit, FALLBACK.treatment.retryLimit, 1),
    };
    this.crisisRules = {
      countdownSeconds: intOf(file.crisis?.countdownSeconds, FALLBACK.crisis.countdownSeconds, 1),
      scope: scoped(file.crisis?.scope),
      pauseOnHide: file.crisis?.pauseOnHide ?? FALLBACK.crisis.pauseOnHide,
      refundRatio: ratioOf(file.crisis?.refundRatio, FALLBACK.crisis.refundRatio),
      heartsPenalty: intOf(file.crisis?.heartsPenalty, FALLBACK.crisis.heartsPenalty),
    };
    this.severityOrder = ordered(file.severityOrder);
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

/** 比例类字段不做取整：0.5 写成整数口径会被 round 成 1，等于全额退药。 */
function ratioOf(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, value));
}

/** 空表或只剩一档就没法「上调」，整段回落兜底。 */
function ordered(value: string[] | undefined): readonly string[] {
  const list = Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.length > 0) : [];
  return list.length >= 2 ? list : FALLBACK.severityOrder;
}

function scoped(value: readonly string[] | undefined): readonly string[] {
  const list = Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.length > 0) : [];
  return list.length > 0 ? list : FALLBACK.crisis.scope;
}

export const PenaltyConfig = new PenaltyConfigStore();
