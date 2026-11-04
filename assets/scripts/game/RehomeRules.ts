// STATUS: implemented, W25 P2-D 送养纯规则（照护度→通过率、感谢金与世代衰减；只依赖类型，可被 Node 直接回归）
import type { HabitatPet } from '../cache/HabitatCodec';
import type { RehomeConfigData } from '../config/RehomeDefaults';

export type CareStats = Pick<HabitatPet, 'hunger' | 'cleanliness' | 'mood'>;

/** 照护度 = 三项属性均值 / 100，落在 0-1；属性已是整数，这里不取整，避免小分差被抹平。 */
export function careScore(entry: CareStats): number {
  const sum = entry.hunger + entry.cleanliness + entry.mood;
  return Math.max(0, Math.min(1, sum / 300));
}

/** 通过率在配置区间内线性映射：照护度 0 → min，满 100 → max；结果保留到千分位。 */
export function passRate(care: number, rate: RehomeConfigData['rate']): number {
  const safe = Math.max(0, Math.min(1, Number.isFinite(care) ? care : 0));
  const value = rate.min + safe * (rate.max - rate.min);
  return Math.round(value * 1000) / 1000;
}

/** 世代衰减按「第几次送养」算：首只 ×1，之后每只 ×decay，最低到 floor（感谢金不会归零）。 */
export function generationScale(generation: number, config: RehomeConfigData['generation']): number {
  const times = Math.max(0, Math.floor(generation));
  const raw = Math.pow(config.decay, times);
  return Math.max(config.floor, Number.isFinite(raw) ? raw : config.floor);
}

/** 感谢金 = (档位基础 + 好感度加成) × 世代衰减；好感度按每点折算并封顶，爱心不在感谢金里发。 */
export function thanksCoins(
  base: number,
  affection: number,
  generation: number,
  config: Pick<RehomeConfigData, 'affection' | 'generation'>,
): number {
  const bonus = Math.min(config.affection.maxBonus, Math.max(0, Math.floor(affection)) * config.affection.perPoint);
  const total = (Math.max(0, base) + bonus) * generationScale(generation, config.generation);
  return Math.max(0, Math.round(total));
}
