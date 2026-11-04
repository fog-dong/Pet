// STATUS: implemented, W25 P2-D 送养配置加载（rehome.json 为唯一数值口径；缺配/非法回落内置同值并 Track）
import { loadConfigJson } from './ConfigLoader';
import { REHOME_FALLBACK, RehomeConfigData } from './RehomeDefaults';
import { Track } from '../track/Track';

interface RehomeFile {
  version?: number;
  cost?: Partial<Record<keyof RehomeConfigData['cost'], unknown>>;
  reviewMs?: unknown;
  rate?: Partial<Record<keyof RehomeConfigData['rate'], unknown>>;
  thanks?: Partial<Record<keyof RehomeConfigData['thanks'], unknown>>;
  affection?: Partial<Record<keyof RehomeConfigData['affection'], unknown>>;
  generation?: Partial<Record<keyof RehomeConfigData['generation'], unknown>>;
}

function countOf(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.floor(value));
}

/** 概率/系数一律收敛到 0-1：坏配置最多让审核变难，不会出现必过或必败。 */
function ratioOf(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, value));
}

class RehomeConfigStore {
  private data: RehomeConfigData = REHOME_FALLBACK;
  private ready = false;

  get value(): RehomeConfigData {
    return this.data;
  }

  get loaded(): boolean {
    return this.ready;
  }

  async load(): Promise<boolean> {
    if (this.ready) {
      return true;
    }
    const file = await loadConfigJson<RehomeFile>('config/rehome');
    if (!file) {
      Track.track('config_missing', { key: 'rehome' });
      return false;
    }
    const base = REHOME_FALLBACK;
    const cost = file.cost ?? {};
    const rate = file.rate ?? {};
    const thanks = file.thanks ?? {};
    const affection = file.affection ?? {};
    const generation = file.generation ?? {};
    const min = ratioOf(rate.min, base.rate.min);
    const max = ratioOf(rate.max, base.rate.max);
    this.data = {
      cost: {
        coins: countOf(cost.coins, base.cost.coins),
        hearts: countOf(cost.hearts, base.cost.hearts),
        skipHearts: countOf(cost.skipHearts, base.cost.skipHearts),
      },
      // 审核时长为 0 会让跳过按钮失去意义；至少留 1 分钟。
      reviewMs: Math.max(60 * 1000, countOf(file.reviewMs, base.reviewMs)),
      // 配置把上下限写反时按「低-高」纠正，保证公式仍单调。
      rate: { min: Math.min(min, max), max: Math.max(min, max) },
      thanks: {
        common: countOf(thanks.common, base.thanks.common),
        rare: countOf(thanks.rare, base.thanks.rare),
        legendary: countOf(thanks.legendary, base.thanks.legendary),
      },
      affection: {
        perPoint: countOf(affection.perPoint, base.affection.perPoint),
        maxBonus: countOf(affection.maxBonus, base.affection.maxBonus),
      },
      generation: {
        decay: ratioOf(generation.decay, base.generation.decay),
        floor: ratioOf(generation.floor, base.generation.floor),
      },
    };
    this.ready = true;
    return true;
  }
}

export const RehomeConfig = new RehomeConfigStore();
