// STATUS: implemented, W25 P2-C 后院与合成的内置兜底（与 garden.json / recipes.json 同值；缺配仍可玩且由加载器 Track 留痕）
/** 单株作物：种子价、成熟分钟、单次收获株数、苗色（Graphics 画苗用，不引新贴图）。 */
export interface CropConfig {
  id: string;
  name: string;
  seedCoins: number;
  growMinutes: number;
  yield: number;
  tint: string;
}

export interface GardenData {
  plots: { unlocked: number; max: number; costs: readonly number[] };
  water: { minutesSaved: number; dailyLimitPerPlot: number; costCoins: number };
  dailyHarvestLimit: number;
  crops: readonly CropConfig[];
}

export const GARDEN_FALLBACK: GardenData = {
  plots: { unlocked: 2, max: 6, costs: [120, 240, 420, 700] },
  water: { minutesSaved: 20, dailyLimitPerPlot: 2, costCoins: 0 },
  dailyHarvestLimit: 12,
  crops: [
    { id: 'mint', name: '薄荷', seedCoins: 40, growMinutes: 120, yield: 2, tint: '#A8C3A0' },
    { id: 'chamomile', name: '洋甘菊', seedCoins: 60, growMinutes: 150, yield: 2, tint: '#E8D48A' },
    { id: 'catnip', name: '猫薄荷', seedCoins: 90, growMinutes: 180, yield: 3, tint: '#B7A6D9' },
  ],
};

/** 合成配方的一味材料；草药全部走已有 items 字段（herb_mint 等），不新增存档字段。 */
export interface RecipeIngredient {
  item: string;
  count: number;
}

export interface CraftRecipe {
  id: string;
  name: string;
  out: string;
  outQty: number;
  ins: readonly RecipeIngredient[];
  coins: number;
}

export interface RecipeData {
  dailyCraftLimit: number;
  recipes: readonly CraftRecipe[];
}

export const RECIPE_FALLBACK: RecipeData = {
  dailyCraftLimit: 3,
  recipes: [
    {
      id: 'premium_food',
      name: '高级粮',
      out: 'item_premium_food',
      outQty: 2,
      ins: [
        { item: 'herb_mint', count: 2 },
        { item: 'herb_chamomile', count: 1 },
      ],
      coins: 20,
    },
    {
      id: 'calming_balm',
      name: '舒缓药膏',
      out: 'item_calming_balm',
      outQty: 1,
      ins: [
        { item: 'herb_chamomile', count: 2 },
        { item: 'herb_catnip', count: 1 },
      ],
      coins: 30,
    },
    {
      id: 'deworm_drops',
      name: '驱虫药剂',
      out: 'item_deworm',
      outQty: 1,
      ins: [
        { item: 'herb_catnip', count: 2 },
        { item: 'herb_mint', count: 1 },
      ],
      coins: 40,
    },
  ],
};
