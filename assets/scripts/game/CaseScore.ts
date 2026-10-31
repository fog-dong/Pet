// STATUS: implemented, W18-1 单局评分（03 §8.2 / 05 §3 / 06 §2.1 对齐）
import type { CaseRewardConfig, TreatmentCorrect } from '../config/CaseConfig';

export interface TreatmentPlan {
  medicines: readonly string[];
  bed: string;
  time: string;
}

export interface RewardAmounts {
  coins: number;
  hearts: number;
}

const STAR_RATE: readonly number[] = [0, 0.5, 0.8, 1];
/** 05 §4 时间选择决定康复时长；03 §5 康复目标 15-30 秒。 */
const RECOVERY_SECONDS: Readonly<Record<string, number>> = { 正常: 20, 加速: 12, 观察: 26 };

/** 时间选择决定康复时长：加速更短，但治疗评分要求选对。 */
export function recoverySeconds(time: string): number {
  return RECOVERY_SECONDS[time] ?? RECOVERY_SECONDS['正常'];
}

/** 05 §3：危重病例治疗难度上升，必须 3/3 全对；普通/紧急 2/3 即成功。 */
export function treatmentThreshold(severity: string): number {
  return severity === 'critical' ? 3 : 2;
}

/**
 * 药品允许多选：只有“恰好选中对症药”才拿药分；多选了别的药视为用错药，0 分。
 * 服务端 syncCaseResult/formula.ts 用同一口径复核 medicineUsed。
 */
export function medicineMatches(used: readonly string[], correct: string): boolean {
  return !!correct && used.length === 1 && used[0] === correct;
}

/** 治疗 3 选：药 / 床 / 时间各 1 分。 */
export function judgeTreatment(plan: TreatmentPlan, correct: TreatmentCorrect): number {
  return (
    (medicineMatches(plan.medicines, correct.medicine) ? 1 : 0) +
    (plan.bed === correct.bed ? 1 : 0) +
    (plan.time === correct.time ? 1 : 0)
  );
}

/** 命中危急度门槛才算成功；3/3 记 3 星，刚过门槛记 2 星。 */
export function treatmentStars(score: number, severity = 'normal'): number {
  if (score < treatmentThreshold(severity)) {
    return 0;
  }
  return score >= 3 ? 3 : 2;
}

/** 康复星级按实际耗时占比：广告减半 → 3 星；自然完成 → 2 星。 */
export function recoveryStars(elapsedMs: number, totalMs: number): number {
  if (totalMs <= 0) {
    return 2;
  }
  const ratio = Math.max(0, Math.min(2, elapsedMs / totalMs));
  if (ratio <= 0.6) {
    return 3;
  }
  return ratio <= 1 ? 2 : 1;
}

/**
 * 03 §8.2：3 星需诊断与治疗全对；2 星为两项均达标；否则 1 星。
 * 康复本身不锁 3 星（避免「必须看广告」），加速只负责把 2 星补成 3 星。
 */
export function totalStars(diagnosis: number, treatment: number, recovery: number): number {
  if (treatment <= 0) {
    return 0;
  }
  if (diagnosis >= 3 && treatment >= 3) {
    return 3;
  }
  if (diagnosis >= 2 && treatment >= 2) {
    return recovery >= 3 ? 3 : 2;
  }
  return 1;
}

export function rewardAmounts(base: CaseRewardConfig, stars: number, firstClear: boolean): RewardAmounts {
  const rate = STAR_RATE[stars] ?? 0;
  return {
    coins: Math.round(base.coins * rate * (firstClear ? 1.5 : 1)),
    hearts: Math.round(base.hearts * rate),
  };
}

/** 06 §2.1 单局折算：诊断 15/10/5、治疗 20/10、对症药 +5、康复护理 +5，满分 45。 */
export function affectionGain(
  diagnosisStars: number,
  treatmentScore: number,
  medicineCorrect: boolean,
  cared: boolean,
): number {
  const diagnosis = [0, 5, 10, 15][Math.max(0, Math.min(3, Math.round(diagnosisStars)))];
  const treatment = treatmentScore >= 3 ? 20 : treatmentScore >= 2 ? 10 : 0;
  return diagnosis + treatment + (medicineCorrect ? 5 : 0) + (cared ? 5 : 0);
}
