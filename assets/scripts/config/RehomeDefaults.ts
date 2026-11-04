// STATUS: implemented, W25 P2-D 送养配置口径（rehome.json 唯一数值来源；缺配回落这里的内置同值）
import type { GachaTier } from './GachaConfig';

export interface RehomeCostConfig {
  coins: number;
  hearts: number;
  skipHearts: number;
}

export interface RehomeRateConfig {
  min: number;
  max: number;
}

export type RehomeThanksConfig = Record<GachaTier, number>;

export interface RehomeAffectionConfig {
  perPoint: number;
  maxBonus: number;
}

export interface RehomeGenerationConfig {
  decay: number;
  floor: number;
}

export interface RehomeConfigData {
  cost: RehomeCostConfig;
  reviewMs: number;
  rate: RehomeRateConfig;
  thanks: RehomeThanksConfig;
  affection: RehomeAffectionConfig;
  generation: RehomeGenerationConfig;
}

/** 与 rehome.json 同值：配置缺失时玩法仍可完整跑通，只在 Track 留痕。 */
export const REHOME_FALLBACK: RehomeConfigData = {
  cost: { coins: 150, hearts: 5, skipHearts: 3 },
  reviewMs: 30 * 60 * 1000,
  rate: { min: 0.55, max: 0.95 },
  thanks: { common: 600, rare: 1200, legendary: 2400 },
  affection: { perPoint: 4, maxBonus: 400 },
  generation: { decay: 0.8, floor: 0.25 },
};
