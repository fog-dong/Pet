// STATUS: implemented, W22-2 生命周期纯函数（年龄文本 / 阶段枚举 / 寿命进度）
// 零 `cc` 依赖，可被 node --experimental-strip-types 直接单测（沿用 game/CaseScore.ts 的可测口径）。
// 口径（2026-11-03 决策-3）：单位一律是**现实自然日**，不引入加速倍率；宠物不会死，
// 进度条只表达「陪伴了多久」；品种差异全部来自 pets.json 的三字段，禁止按 petId 分支。
import type { PetConfigItem } from '../config/CharacterConfig';

export const DAY_MS = 24 * 60 * 60 * 1000;
/** 展示换算：1 现实日 = 1 宠物月，12 宠物月 = 1 宠物岁。只影响文案，不影响任何推进速度。 */
export const DAYS_PER_PET_YEAR = 12;

export type LifeStage = 'baby' | 'adult' | 'senior';

export const LIFE_STAGES: readonly LifeStage[] = ['baby', 'adult', 'senior'];

export const STAGE_LABEL: Record<LifeStage, string> = {
  baby: '幼年',
  adult: '成年',
  senior: '老年',
};

/** 配置缺字段（老配置 / 配置未加载）时的兜底档位：中型猫。全仓只有这一处兜底。 */
export const DEFAULT_LIFESPAN = {
  expectedLifespanDays: 500,
  maturityAgeDays: 120,
  seniorAgeDays: 400,
};

export interface LifeSpan {
  expectedLifespanDays: number;
  maturityAgeDays: number;
  seniorAgeDays: number;
}

/** 读配置并夹成可用阈值；顺序异常（senior ≤ maturity）时整档回落到兜底，避免阶段判定出现空区间。 */
export function lifeSpanOf(item?: PetConfigItem | null): LifeSpan {
  const expected = positive(item?.expectedLifespanDays, DEFAULT_LIFESPAN.expectedLifespanDays);
  const maturity = positive(item?.maturityAgeDays, DEFAULT_LIFESPAN.maturityAgeDays);
  const senior = positive(item?.seniorAgeDays, DEFAULT_LIFESPAN.seniorAgeDays);
  if (!(maturity < senior && senior <= expected)) {
    return { ...DEFAULT_LIFESPAN };
  }
  return { expectedLifespanDays: expected, maturityAgeDays: maturity, seniorAgeDays: senior };
}

/** 已经陪伴的天数；出生时间在未来（改机/时钟漂移）按 0 天算，绝不返回负数。 */
export function ageInDays(birthTimestamp: number, now: number): number {
  if (!Number.isFinite(birthTimestamp) || !Number.isFinite(now)) {
    return 0;
  }
  return Math.max(0, Math.floor((now - birthTimestamp) / DAY_MS));
}

export function getLifeStage(
  birthTimestamp: number,
  item?: PetConfigItem | null,
  now: number = Date.now(),
): LifeStage {
  const span = lifeSpanOf(item);
  const days = ageInDays(birthTimestamp, now);
  if (days < span.maturityAgeDays) {
    return 'baby';
  }
  return days < span.seniorAgeDays ? 'adult' : 'senior';
}

/** 0-1 寿命进度：到达预期寿命后**钳在 1.0**（不老不死，进度条不是倒计时）。 */
export function getLifeProgress(
  birthTimestamp: number,
  item?: PetConfigItem | null,
  now: number = Date.now(),
): number {
  const span = lifeSpanOf(item);
  return Math.max(0, Math.min(1, ageInDays(birthTimestamp, now) / span.expectedLifespanDays));
}

/** "1 岁 2 个月" / "5 个月" / "出生当天"。 */
export function getAgeText(
  birthTimestamp: number,
  item?: PetConfigItem | null,
  now: number = Date.now(),
): string {
  const days = ageInDays(birthTimestamp, now);
  const years = Math.floor(days / DAYS_PER_PET_YEAR);
  const months = days % DAYS_PER_PET_YEAR;
  if (years === 0) {
    return months === 0 ? '出生当天' : `${months} 个月`;
  }
  return months === 0 ? `${years} 岁` : `${years} 岁 ${months} 个月`;
}

/** 详情行文案「预计寿命：X 岁」；同样按展示换算折算，不是真实天数。 */
export function lifespanText(item?: PetConfigItem | null): string {
  const years = Math.max(1, Math.round(lifeSpanOf(item).expectedLifespanDays / DAYS_PER_PET_YEAR));
  return `预计寿命：${years} 岁`;
}

function positive(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}
