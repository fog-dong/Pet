// STATUS: implemented, W25 P2-C 后院配置加载（garden.json 为唯一数值口径；缺配/整表不合法回落内置同值并 Track）
import { loadConfigJson } from './ConfigLoader';
import { CropConfig, GARDEN_FALLBACK, GardenData } from './GardenDefaults';
import { Track } from '../track/Track';

interface GardenFile {
  version?: number;
  plots?: { unlocked?: unknown; max?: unknown; costs?: unknown };
  water?: { minutesSaved?: unknown; dailyLimitPerPlot?: unknown; costCoins?: unknown };
  dailyHarvestLimit?: unknown;
  crops?: unknown;
}

/** 只做取值守卫，不做业务判定：负数/非整数一律回落到兜底值。 */
function intOf(value: unknown, fallback: number, min = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.floor(value));
}

function costListOf(value: unknown, fallback: readonly number[]): number[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }
  const costs = value.map((item) => intOf(item, -1, -1)).filter((item) => item >= 0);
  return costs.length > 0 ? costs : [...fallback];
}

function cropOf(raw: unknown): CropConfig | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const item = raw as Partial<CropConfig>;
  if (typeof item.id !== 'string' || !item.id) {
    return null;
  }
  const name = typeof item.name === 'string' && item.name ? item.name : item.id;
  const tint = typeof item.tint === 'string' && item.tint ? item.tint : '#A8C3A0';
  return {
    id: item.id,
    name,
    seedCoins: intOf(item.seedCoins, 0),
    growMinutes: intOf(item.growMinutes, 1, 1),
    yield: intOf(item.yield, 1, 1),
    tint,
  };
}

class GardenConfigStore {
  private data: GardenData = GARDEN_FALLBACK;
  private ready = false;

  get plots(): GardenData['plots'] {
    return this.data.plots;
  }

  get water(): GardenData['water'] {
    return this.data.water;
  }

  get dailyHarvestLimit(): number {
    return this.data.dailyHarvestLimit;
  }

  get crops(): readonly CropConfig[] {
    return this.data.crops;
  }

  get loaded(): boolean {
    return this.ready;
  }

  cropById(id: string): CropConfig | null {
    return this.data.crops.find((crop) => crop.id === id) ?? null;
  }

  async load(): Promise<boolean> {
    if (this.ready) {
      return true;
    }
    const file = await loadConfigJson<GardenFile>('config/garden');
    if (!file) {
      Track.track('config_missing', { key: 'garden' });
      return false;
    }
    const crops: CropConfig[] = [];
    if (Array.isArray(file.crops)) {
      file.crops.forEach((raw) => {
        const crop = cropOf(raw);
        // 重复 id 会让 herb_<id> 指向同一格库存，按无效配置处理掉后一条。
        if (crop && !crops.some((entry) => entry.id === crop.id)) {
          crops.push(crop);
        }
      });
    }
    if (crops.length === 0) {
      Track.track('config_invalid', { key: 'garden' });
      return false;
    }
    const unlocked = intOf(file.plots?.unlocked, GARDEN_FALLBACK.plots.unlocked);
    this.data = {
      plots: {
        unlocked,
        max: Math.max(unlocked, intOf(file.plots?.max, GARDEN_FALLBACK.plots.max, 1)),
        costs: costListOf(file.plots?.costs, GARDEN_FALLBACK.plots.costs),
      },
      water: {
        minutesSaved: intOf(file.water?.minutesSaved, GARDEN_FALLBACK.water.minutesSaved),
        dailyLimitPerPlot: intOf(file.water?.dailyLimitPerPlot, GARDEN_FALLBACK.water.dailyLimitPerPlot),
        costCoins: intOf(file.water?.costCoins, GARDEN_FALLBACK.water.costCoins),
      },
      dailyHarvestLimit: intOf(file.dailyHarvestLimit, GARDEN_FALLBACK.dailyHarvestLimit, 1),
      crops,
    };
    this.ready = true;
    return true;
  }
}

export const GardenConfig = new GardenConfigStore();
