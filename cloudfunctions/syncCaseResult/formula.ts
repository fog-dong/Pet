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
  // W18：药品支持多选，客户端口径是“恰好选中对症药”才得分，多选错药记 0。
  const used = Array.isArray(treatment.medicineUsed) ? treatment.medicineUsed : [];
  const medicineOk = correct.medicine !== undefined && used.length === 1 && used[0] === correct.medicine ? 1 : 0;
  const bedOk = correct.bed !== undefined && treatment.bedUsed === (correct.bed === '住院') ? 1 : 0;
  return medicineOk + bedOk;
}

/** 05 §3：危重病例必须 3/3 全对，普通/紧急 2/3 即成功。 */
function treatmentThreshold(severity: string): number {
  return severity === 'critical' ? 3 : 2;
}

function treatmentStars(score: number, severity: string): number {
  if (score < treatmentThreshold(severity)) {
    return 0;
  }
  return score >= 3 ? 3 : 2;
}

/** 03 §8.2：诊断与治疗全对为 3 星；两项达标为 2 星（康复回调为 1 星，不会误升）。 */
function totalStars(diagnosis: number, treatment: number, recovery: number): number {
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

/** 06 §2.1 单局折算：诊断 15/10/5、治疗 20/10、对症药 +5、康复护理 +5。 */
function affectionGain(
  diagnosisStars: number,
  treatmentScore: number,
  medicineCorrect: boolean,
  cared: boolean,
): number {
  const diagnosis = [0, 5, 10, 15][clampInt(diagnosisStars, 0, 3)];
  const treatment = treatmentScore >= 3 ? 20 : treatmentScore >= 2 ? 10 : 0;
  return diagnosis + treatment + (medicineCorrect ? 5 : 0) + (cared ? 5 : 0);
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
  const severity = item.severity ?? 'normal';
  const threshold = treatmentThreshold(severity);
  const stars = treatmentStars(treatmentScore, severity);
  const used = Array.isArray(treatment.medicineUsed) ? treatment.medicineUsed : [];
  const medicineOk =
    typeof item.treatment?.correct?.medicine === 'string' &&
    used.length === 1 &&
    used[0] === item.treatment.correct.medicine;
  return {
    stars: totalStars(diagnosisStars, stars, RECOVERY_STARS_FALLBACK),
    diagnosisStars,
    treatmentScore,
    treatmentStars: stars,
    recoveryStars: RECOVERY_STARS_FALLBACK,
    status: treatmentScore >= 3 ? 'succeeded' : treatmentScore >= threshold ? 'partial' : 'failed',
    // 康复星级未进冻结入参，服务端按「自然完成」记护理分，与客户端不加速时一致。
    affection: affectionGain(diagnosisStars, treatmentScore, medicineOk, true),
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
