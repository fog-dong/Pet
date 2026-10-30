// STATUS: implemented, W12-3 服务端结算公式（纯函数，镜像客户端 CaseScore）
import type {
  CaseConfigItem,
  ComputedCase,
  DiagnosisInput,
  RewardAmounts,
  RewardConfig,
  TreatmentInput,
} from './types';

const STAR_RATE: readonly number[] = [0, 0.5, 0.8, 1];
/**
 * 冻结入参 §2.4 没有康复耗时字段，服务端按客户端「未进康复页」的默认值 1 星重算。
 * 差异记在《架构质检-W12》D13，接口追加 recovery 字段后再对齐。
 */
export const RECOVERY_STARS_FALLBACK = 1;

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

/** 服务端能核对的只有药 / 床两项；时间选项不在冻结入参里（见 D13）。 */
function verifiedScore(item: CaseConfigItem, treatment: TreatmentInput): number {
  const correct = item.treatment?.correct ?? {};
  const medicineOk = correct.medicine !== undefined && treatment.medicineUsed.includes(correct.medicine) ? 1 : 0;
  const bedOk = correct.bed !== undefined && treatment.bedUsed === (correct.bed === '住院') ? 1 : 0;
  return medicineOk + bedOk;
}

function treatmentStars(score: number): number {
  if (score >= 3) {
    return 3;
  }
  return score >= 2 ? 2 : 0;
}

/** 总星级 = 三项平均后四舍五入；治疗未成功（<2 分）直接 0 星。 */
function totalStars(diagnosis: number, treatment: number, recovery: number): number {
  if (treatment <= 0) {
    return 0;
  }
  return Math.max(1, Math.min(3, Math.round((diagnosis + treatment + recovery) / 3)));
}

export function computeCase(
  item: CaseConfigItem,
  diagnosis: DiagnosisInput,
  treatment: TreatmentInput,
): ComputedCase {
  const diagnosisStars = clampInt(diagnosis.stars, 0, 3);
  // 客户端 healing = 药 + 床 + 时间（0..3）；服务端把不可核对的时间项夹在 [verified, verified+1]。
  const verified = verifiedScore(item, treatment);
  const claimed = clampInt(treatment.healing, 0, 3);
  const treatmentScore = Math.min(Math.max(claimed, verified), verified + 1);
  const stars = treatmentStars(treatmentScore);
  return {
    stars: totalStars(diagnosisStars, stars, RECOVERY_STARS_FALLBACK),
    diagnosisStars,
    treatmentScore,
    treatmentStars: stars,
    recoveryStars: RECOVERY_STARS_FALLBACK,
    status: treatmentScore >= 3 ? 'succeeded' : treatmentScore === 2 ? 'partial' : 'failed',
    affection: Math.max(1, Math.round(item.baseRewards.affection + treatmentScore)),
  };
}

/** 首通只影响金币（×1.5），爱心与好感度按基础值算。 */
export function rewardAmounts(base: RewardConfig, stars: number, firstClear: boolean): RewardAmounts {
  const rate = STAR_RATE[stars] ?? 0;
  return {
    coins: Math.round(base.coins * rate * (firstClear ? 1.5 : 1)),
    hearts: Math.round(base.hearts * rate),
  };
}
