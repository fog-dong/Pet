// STATUS: implemented, W25 P2-C 后院开垦与草药合成（合成扣草药产出道具；每日次数上限与收获共用日期键）
import { emptyPlot } from '../cache/GardenCodec';
import { todayKey } from '../cache/DayKey';
import { Save } from '../cache/Save';
import { GardenConfig } from '../config/GardenConfig';
import { RecipeConfig } from '../config/RecipeConfig';
import { bumpCounter } from './Counters';
import { blocked, done, GardenResult, gardenView, herbLabel } from './GardenModel';
import { limitLeft, nextPlotCost, quotaUsed } from './GardenRules';

export function unlockPlot(): GardenResult {
  const view = gardenView();
  const cost = nextPlotCost(
    view.plots.length,
    GardenConfig.plots.unlocked,
    GardenConfig.plots.costs,
    GardenConfig.plots.max,
  );
  if (cost === null) {
    return blocked('后院已经开满了');
  }
  if (cost > 0 && !Save.spendCoins(cost)) {
    return blocked(`金币不足，开垦这块地要 ${cost} 金币`);
  }
  Save.mutate((data) => {
    data.garden.push(emptyPlot(data.garden.length));
  });
  return done('开垦成功，多了一块地');
}

export function craftRecipe(recipeId: string): GardenResult {
  const recipe = RecipeConfig.recipeById(recipeId);
  if (!recipe) {
    return blocked('没有这个配方');
  }
  const day = todayKey();
  const used = quotaUsed(Save.snapshot().gardenQuota, day);
  if (limitLeft(used.craft, RecipeConfig.dailyCraftLimit) <= 0) {
    return blocked(`今日合成次数已用完（${RecipeConfig.dailyCraftLimit} 次）`);
  }
  const missing = recipe.ins.find((entry) => Save.itemCount(entry.item) < entry.count);
  if (missing) {
    return blocked(`${herbLabel(missing.item)}不足`);
  }
  if (recipe.coins > 0 && !Save.spendCoins(recipe.coins)) {
    return blocked(`金币不足，合成要 ${recipe.coins} 金币`);
  }
  Save.mutate((data) => {
    recipe.ins.forEach((entry) => {
      data.items[entry.item] = Math.max(0, (data.items[entry.item] ?? 0) - entry.count);
    });
    data.items[recipe.out] = (data.items[recipe.out] ?? 0) + recipe.outQty;
    data.gardenQuota = { day, harvest: used.harvest, craft: used.craft + 1 };
  });
  bumpCounter('craftCount');
  return done(`合成了 ${recipe.name} ×${recipe.outQty}`);
}
