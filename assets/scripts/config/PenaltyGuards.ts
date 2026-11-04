// STATUS: implemented, W25 P2-A3 配置取值守卫（从 PenaltyConfig 抽出，压住 150 行红线）
import { PENALTY_FALLBACK as FALLBACK } from './PenaltyDefaults';

/** 配置里的负数或非法值一律回到兜底，避免一个错字把惩罚算成收益。 */
export function intOf(value: number | undefined, fallback: number, min = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.round(value));
}

/** 比例类字段不做取整：0.5 写成整数口径会被 round 成 1，等于全额退药。 */
export function ratioOf(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, value));
}

/** 空表或只剩一档就没法「上调」，整段回落兜底。 */
export function ordered(value: string[] | undefined): readonly string[] {
  const list = Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.length > 0) : [];
  return list.length >= 2 ? list : FALLBACK.severityOrder;
}

export function scoped(value: readonly string[] | undefined): readonly string[] {
  const list = Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.length > 0) : [];
  return list.length > 0 ? list : FALLBACK.crisis.scope;
}
