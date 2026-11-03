// STATUS: implemented, W22-4 生命周期时间衰减 + 阶段倍率 + 老年小毛病（纯计算：零平台依赖、零存档读写）
// 口径出处：docs/plan/W20-长线养成与小屋扩充方案.md §2.2（基准速率）与 §2.2.1（阶段倍率，2026-11-03 决策-3）。
// 不挂 setInterval：小游戏切后台会被挂起，一切补算都按 lastDecayAt 水位在「进屋 / 互动前」一次性发生。
// 阶段由调用方查 pets.json 后传入，夹紧函数由调用方注入（clampStat 的唯一实现仍在 cache/HabitatCodec），
// 这样本文件没有任何运行时 import（`import type` 会被擦除），可被 node --experimental-strip-types 直接单测。
import type { HabitatPet } from '../cache/HabitatCodec';
import type { HabitatRule } from './HabitatRules';
import type { LifeStage } from './AgeSystem';

const HOUR_MS = 60 * 60 * 1000;

/** §2.2 基准衰减速率（每小时）：成年档就是这一行。 */
const DECAY_PER_HOUR = { hunger: 6, cleanliness: 4, mood: 5 };
/** hunger 或 cleanliness 低于该值时，心情额外按 §2.2 多扣。 */
const LOW_STAT_THRESHOLD = 30;
const EXTRA_MOOD_PER_HOUR = 10;
/**
 * 单次补算最多回溯的小时数。没有这条上限，出差三天回来属性会全 0，
 * 与 §2.2「一天 2–3 次互动即可维持，不做必须准点上线」和「最差只是降级表现」直接冲突。
 */
export const MAX_SETTLE_HOURS = 24;

/** 阶段 → 衰减倍率（模块三）：幼年饿得快、心情掉得快；成年为基准；老年不加速衰减。 */
export const STAGE_DECAY: Record<LifeStage, { hunger: number; cleanliness: number; mood: number }> = {
  baby: { hunger: 1.5, cleanliness: 1, mood: 1.2 },
  adult: { hunger: 1, cleanliness: 1, mood: 1 },
  senior: { hunger: 1, cleanliness: 1, mood: 1 },
};

/** 阶段 → 心情类互动收益倍率：老年「跑不动了」，抚摸收益减半。只削收益，不增加消耗频次。 */
export const STAGE_MOOD_GAIN: Record<LifeStage, number> = { baby: 1, adult: 1, senior: 0.5 };

/** 老年小毛病触发后，当天第一次互动额外消耗的爱心（安抚）。 */
export const AILMENT_HEART_COST = 3;
/** 老年每天触发小毛病的概率（百分比）。 */
export const AILMENT_ODDS_PERCENT = 25;

/** 本次要补算的小时数：水位在未来或不足 1 小时都是 0；上限夹紧见 MAX_SETTLE_HOURS。 */
export function elapsedDecayHours(lastDecayAt: number, now: number): number {
  if (!(lastDecayAt > 0) || !(now > lastDecayAt)) {
    return 0;
  }
  return Math.min(MAX_SETTLE_HOURS, Math.floor((now - lastDecayAt) / HOUR_MS));
}

/** 就地扣减三项属性并把水位按整小时前移（零头留到下次，不因反复进出小屋而丢进度）。 */
export function applyDecay(
  entry: HabitatPet,
  stage: LifeStage,
  hours: number,
  clamp: (value: number) => number,
): void {
  const rate = STAGE_DECAY[stage];
  const extraMood = entry.hunger < LOW_STAT_THRESHOLD || entry.cleanliness < LOW_STAT_THRESHOLD
    ? EXTRA_MOOD_PER_HOUR
    : 0;
  entry.hunger = clamp(entry.hunger - DECAY_PER_HOUR.hunger * rate.hunger * hours);
  entry.cleanliness = clamp(entry.cleanliness - DECAY_PER_HOUR.cleanliness * rate.cleanliness * hours);
  entry.mood = clamp(entry.mood - (DECAY_PER_HOUR.mood * rate.mood + extraMood) * hours);
  entry.lastDecayAt += hours * HOUR_MS;
}

/** 本次互动的实际收益：心情按阶段打折后取整，其余属性不受阶段影响。 */
export function statDelta(rule: HabitatRule, stage: LifeStage): number {
  return rule.stat === 'mood'
    ? Math.max(1, Math.round(rule.delta * STAGE_MOOD_GAIN[stage]))
    : rule.delta;
}

/** 互动飘字按实际收益生成，避免老年显示「+10 心情」却只加 5。 */
export function floatTextOf(rule: HabitatRule, delta: number): string {
  return `+${delta} ${rule.statLabel}`;
}

/**
 * 老年小毛病今天要不要安抚：只限老年、且当天还没安抚过。
 * 用 hash(petId|dayKey) 而不是 Math.random——同一天重进小屋表现必须一致，否则截图与验收无法复现。
 */
export function ailmentCost(entry: HabitatPet, stage: LifeStage, dayKey: string): number {
  if (stage !== 'senior' || !dayKey || entry.soothedDay === dayKey) {
    return 0;
  }
  return hash32(`${entry.petId}|${dayKey}`) % 100 < AILMENT_ODDS_PERCENT ? AILMENT_HEART_COST : 0;
}

function hash32(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}
