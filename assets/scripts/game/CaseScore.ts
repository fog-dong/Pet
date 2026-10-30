// STATUS: implemented, W3 单局评分与奖励（纯函数，无副作用）
import type { CaseRewardConfig, TreatmentCorrect } from '../config/CaseConfig';

export interface TreatmentPlan {
  medicine: string;
  bed: string;
  time: string;
}

export interface RewardAmounts {
  coins: number;
  hearts: number;
}

const STAR_RATE: readonly number[] = [0, 0.5, 0.8, 1];
const RECOVERY_SECONDS: Readonly<Record<string, number>> = { 正常: 14, 加速: 9, 观察: 18 };
/** 康复星级的分母：按“正常等待 14 秒”为基准，选加速或看广告越快星越高。 */
export const RECOVERY_REFERENCE_MS = 14000;

/** 时间选择决定康复时长：加速更短，但治疗评分要求选对。 */
export function recoverySeconds(time: string): number {
  return RECOVERY_SECONDS[time] ?? 14;
}

/** 治疗 3 选：药 / 床 / 时间各 1 分，2 分算治疗成功。 */
export function judgeTreatment(plan: TreatmentPlan, correct: TreatmentCorrect): number {
  return (
    (plan.medicine === correct.medicine ? 1 : 0) +
    (plan.bed === correct.bed ? 1 : 0) +
    (plan.time === correct.time ? 1 : 0)
  );
}

export function treatmentStars(score: number): number {
  if (score >= 3) {
    return 3;
  }
  return score >= 2 ? 2 : 0;
}

/** 康复星级按真实耗时占比：广告加速把耗时压到一半即可拿 3 星。 */
export function recoveryStars(elapsedMs: number, totalMs: number): number {
  if (totalMs <= 0) {
    return 1;
  }
  const ratio = Math.max(0, Math.min(1, elapsedMs / totalMs));
  if (ratio <= 0.55) {
    return 3;
  }
  return ratio <= 0.85 ? 2 : 1;
}

/** 总星级 = 诊断 / 治疗 / 康复三项平均后取整，治疗未成功则为 0。 */
export function totalStars(diagnosis: number, treatment: number, recovery: number): number {
  if (treatment <= 0) {
    return 0;
  }
  const clamp = (value: number): number => Math.max(0, Math.min(3, Math.round(value)));
  const average = (clamp(diagnosis) + clamp(treatment) + clamp(recovery)) / 3;
  return Math.max(1, Math.min(3, Math.round(average)));
}

export function rewardAmounts(base: CaseRewardConfig, stars: number, firstClear: boolean): RewardAmounts {
  const rate = STAR_RATE[stars] ?? 0;
  return {
    coins: Math.round(base.coins * rate * (firstClear ? 1.5 : 1)),
    hearts: Math.round(base.hearts * rate),
  };
}

/** 好感度 = 病例基础好感 + 治疗评分 + 康复速度加成，决定能否领养。 */
export function affectionGain(base: number, treatmentScore: number, recovery: number): number {
  return Math.max(1, Math.round(base + treatmentScore + (recovery >= 3 ? 1 : 0)));
}
