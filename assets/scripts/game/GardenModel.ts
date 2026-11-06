// STATUS: implemented, W25 P2-C 后院数据层基座（视图/除草/墙钟水位；播种浇水收获见 GardenPlanting，开垦合成见 GardenCraft）
import type { GardenPlot } from '../cache/GardenCodec';
import { emptyPlot } from '../cache/GardenCodec';
import { Save } from '../cache/Save';
import type { CropConfig } from '../config/GardenDefaults';
import { GardenConfig } from '../config/GardenConfig';
import { forwardNow, nextPlotCost } from './GardenRules';

export interface GardenResult {
  kind: 'done' | 'blocked';
  text: string;
  herb?: string;
  qty?: number;
  readyAt?: number;
}

export interface GardenView {
  plots: readonly GardenPlot[];
  locked: number;
  nextCost: number | null;
}

export interface HerbStock {
  crop: CropConfig;
  count: number;
}

export function blocked(text: string): GardenResult {
  return { kind: 'blocked', text };
}

export function done(text: string, extra: Partial<GardenResult> = {}): GardenResult {
  return { kind: 'done', text, ...extra };
}

/** 墙钟只向前：改系统时间往回拨时停在上次水位，作物不会因回拨反复刷新生长。 */
export function gardenNow(): number {
  return forwardNow(Date.now(), Save.snapshot().gardenStamp);
}

export function herbIdOf(crop: CropConfig): string {
  return `herb_${crop.id}`;
}

export function herbLabel(itemId: string): string {
  const crop = GardenConfig.crops.find((item) => herbIdOf(item) === itemId);
  return crop ? crop.name : itemId;
}

/** UI 侧要按苗色给材料 chip 上色；非草药条目返回 null 由调用方兜底色。 */
export function cropOfHerbId(itemId: string): CropConfig | null {
  return GardenConfig.crops.find((crop) => herbIdOf(crop) === itemId) ?? null;
}

export function herbStock(): HerbStock[] {
  Save.load();
  return GardenConfig.crops.map((crop) => ({ crop, count: Save.itemCount(herbIdOf(crop)) }));
}

/** 旧档没有 garden：按配置的初始地块数补种空地块；已买地块只增不减。 */
export function ensureGarden(): readonly GardenPlot[] {
  Save.load();
  const target = Math.min(GardenConfig.plots.max, GardenConfig.plots.unlocked);
  if (Save.snapshot().garden.length >= target) {
    return Save.snapshot().garden;
  }
  Save.mutate((data) => {
    while (data.garden.length < target) {
      data.garden.push(emptyPlot(data.garden.length));
    }
  });
  return Save.snapshot().garden;
}

export function gardenView(): GardenView {
  const plots = ensureGarden();
  const nextCost = nextPlotCost(
    plots.length,
    GardenConfig.plots.unlocked,
    GardenConfig.plots.costs,
    GardenConfig.plots.max,
  );
  return { plots, locked: Math.max(0, GardenConfig.plots.max - plots.length), nextCost };
}
