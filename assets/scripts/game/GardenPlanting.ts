// STATUS: implemented, W25 P2-C 后院种植动作（播种/浇水/收获；计时只走本地墙钟，草药不兑换金币/爱心）
import { todayKey } from '../cache/DayKey';
import { Save } from '../cache/Save';
import { GardenConfig } from '../config/GardenConfig';
import { blocked, done, ensureGarden, gardenNow, herbIdOf } from './GardenModel';
import { GardenResult } from './GardenModel';
import {
  formatRemaining, isReady, limitLeft, matureAt, quotaUsed, waterUsed, wateredReadyAt,
} from './GardenRules';
import { bumpCounter } from './Counters';

export function seedPlot(index: number, cropId: string): GardenResult {
  const plot = ensureGarden()[index];
  const crop = GardenConfig.cropById(cropId);
  if (!plot) {
    return blocked('这块地还没开垦');
  }
  if (plot.cropId) {
    return blocked('这块地已经种上了');
  }
  if (!crop) {
    return blocked('没有这种种子');
  }
  if (crop.seedCoins > 0 && !Save.spendCoins(crop.seedCoins)) {
    return blocked(`金币不足，${crop.name}种子要 ${crop.seedCoins} 金币`);
  }
  const now = gardenNow();
  const readyAt = matureAt(now, crop);
  Save.mutate((data) => {
    const target = data.garden[index];
    if (!target) {
      return;
    }
    target.cropId = crop.id;
    target.plantedAt = now;
    target.readyAt = readyAt;
    target.waterDay = '';
    target.waterCount = 0;
    data.gardenStamp = Math.max(now, data.gardenStamp);
  });
  bumpCounter('gardenPlanted');
  return done(`${crop.name}种下了，${formatRemaining(readyAt - now)}后成熟`, { readyAt });
}

export function waterPlot(index: number): GardenResult {
  const plot = ensureGarden()[index];
  if (!plot || !plot.cropId) {
    return blocked('这块地还没种东西');
  }
  const crop = GardenConfig.cropById(plot.cropId);
  if (!crop) {
    return blocked('作物配置缺失，先收掉重种');
  }
  const day = todayKey();
  const now = gardenNow();
  if (isReady(plot, now)) {
    return blocked('已经成熟了，直接收获吧');
  }
  const limit = GardenConfig.water.dailyLimitPerPlot;
  const used = waterUsed(plot, day);
  if (limitLeft(used, limit) <= 0) {
    return blocked('这块地今天不能再浇水了');
  }
  const cost = GardenConfig.water.costCoins;
  if (cost > 0 && !Save.spendCoins(cost)) {
    return blocked(`金币不足，浇水要 ${cost} 金币`);
  }
  const readyAt = wateredReadyAt(plot.readyAt, GardenConfig.water.minutesSaved);
  Save.mutate((data) => {
    const target = data.garden[index];
    if (!target) {
      return;
    }
    target.readyAt = readyAt;
    target.waterDay = day;
    target.waterCount = used + 1;
    data.gardenStamp = Math.max(now, data.gardenStamp);
  });
  return done(`浇了水，成熟提前 ${GardenConfig.water.minutesSaved} 分钟`, { readyAt });
}

export function harvestPlot(index: number): GardenResult {
  const plot = ensureGarden()[index];
  if (!plot || !plot.cropId) {
    return blocked('这块地还没种东西');
  }
  const crop = GardenConfig.cropById(plot.cropId);
  if (!crop) {
    return blocked('作物配置缺失，先收掉重种');
  }
  const now = gardenNow();
  if (!isReady(plot, now)) {
    return blocked(`还没熟，还要 ${formatRemaining(plot.readyAt - now)}`);
  }
  const day = todayKey();
  const used = quotaUsed(Save.snapshot().gardenQuota, day);
  if (limitLeft(used.harvest, GardenConfig.dailyHarvestLimit) <= 0) {
    return blocked(`今日收获次数已用完（${GardenConfig.dailyHarvestLimit} 次）`);
  }
  const herb = herbIdOf(crop);
  const qty = crop.yield;
  Save.mutate((data) => {
    const target = data.garden[index];
    if (!target) {
      return;
    }
    target.cropId = '';
    target.plantedAt = 0;
    target.readyAt = 0;
    target.waterDay = '';
    target.waterCount = 0;
    data.items[herb] = (data.items[herb] ?? 0) + qty;
    data.gardenQuota = { day, harvest: used.harvest + 1, craft: used.craft };
    data.gardenStamp = Math.max(now, data.gardenStamp);
  });
  bumpCounter('gardenHarvested');
  bumpCounter('herbCount', qty);
  return done(`收获了 ${crop.name} ×${qty}`, { herb, qty });
}
