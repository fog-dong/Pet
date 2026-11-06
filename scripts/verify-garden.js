// STATUS: implemented, W25 P2-C 后院纯函数回归（生长/浇水/每日上限/只向前/编解码/配置一致性）
// 用法：node --experimental-strip-types --no-warnings scripts/verify-garden.js
import { readFileSync } from 'node:fs';
import { GARDEN_FALLBACK, RECIPE_FALLBACK } from '../assets/scripts/config/GardenDefaults.ts';
import { decodeGarden, decodeGardenQuota, emptyPlot } from '../assets/scripts/cache/GardenCodec.ts';
import {
  MINUTE_MS, formatRemaining, forwardNow, growMs, growProgress, isReady, limitLeft, matureAt,
  nextPlotCost, quotaUsed, remainingMs, waterUsed, wateredReadyAt,
} from '../assets/scripts/game/GardenRules.ts';

let failures = 0;

function check(title, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures += 1;
  }
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${title} → ${JSON.stringify(actual)}${ok ? '' : ' 期望 ' + JSON.stringify(expected)}`);
}

function readJson(path) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
}

const MINT = GARDEN_FALLBACK.crops[0];
const T0 = 1762147200000;

console.log('[1] 生长与浇水（只扣剩余 CD，浇过头直接成熟）');
check('薄荷 120 分钟 = 2h', growMs(MINT), 120 * MINUTE_MS);
check('growMinutes 0/-5 夹到 1 分钟', [growMs({ growMinutes: 0 }), growMs({ growMinutes: -5 })], [MINUTE_MS, MINUTE_MS]);
check('成熟时间 = 起点 + 生长时长', matureAt(T0, MINT), T0 + 120 * MINUTE_MS);
check('浇水 -20 分钟', wateredReadyAt(T0 + 120 * MINUTE_MS, 20), T0 + 100 * MINUTE_MS);
check('浇过头落到过去，视为可立即收获',
  [wateredReadyAt(T0 + 5 * MINUTE_MS, 20) <= T0 + 5 * MINUTE_MS,
    isReady({ ...emptyPlot(0), cropId: 'mint', readyAt: wateredReadyAt(T0 + 5 * MINUTE_MS, 20) }, T0 + 5 * MINUTE_MS)],
  [true, true]);
check('负数分钟不推进', wateredReadyAt(T0 + 120 * MINUTE_MS, -20), T0 + 120 * MINUTE_MS);
check('剩余时间不为负', [remainingMs(T0 + MINUTE_MS, T0 + 5 * MINUTE_MS), remainingMs(T0 + MINUTE_MS, T0)], [0, MINUTE_MS]);

console.log('[1b] 生长比例只用于绘图（幼苗分档），不参与结算');
{
  const total = growMs(MINT);
  check('刚播种 = 0', growProgress(T0 + total, T0, total), 0);
  check('半程 = 0.5', growProgress(T0 + total, T0 + total / 2, total), 0.5);
  check('到点 = 1', growProgress(T0 + total, T0 + total, total), 1);
  check('未来时刻夹到 0（客户端时钟超前不出现负比例）', growProgress(T0 + total, T0 - 60 * MINUTE_MS, total), 0);
  check('生长时长异常按成熟处理', [growProgress(T0, T0, 0), growProgress(T0 + total, T0, -1)], [1, 1]);
  const watered = wateredReadyAt(T0 + total, GARDEN_FALLBACK.water.minutesSaved);
  check('同刻比较：浇过水的幼苗比例更高（浇水肉眼可见）',
    growProgress(watered, T0 + total / 2, total) > growProgress(T0 + total, T0 + total / 2, total), true);
}

console.log('[2] 成熟判定与状态提示');
check('空地不算成熟', isReady(emptyPlot(0), T0), false);
check('有种但 readyAt=0 不算成熟', isReady({ ...emptyPlot(0), cropId: 'mint' }, T0), false);
check('到点即成熟', isReady({ ...emptyPlot(0), cropId: 'mint', readyAt: T0 }, T0), true);
check('formatRemaining 0 → 已成熟', formatRemaining(0), '已成熟');
check('30 秒向上取整为 1 分', formatRemaining(30 * 1000), '1分');
check('2 小时整', formatRemaining(120 * MINUTE_MS), '2小时');
check('1 小时 30 分', formatRemaining(90 * MINUTE_MS), '1小时30分');

console.log('[3] 每日上限与浇水次数（跨天自动归零）');
check('同日计数保留', quotaUsed({ day: '2026-11-04', harvest: 5, craft: 2 }, '2026-11-04'), { harvest: 5, craft: 2 });
check('跨天归零', quotaUsed({ day: '2026-11-03', harvest: 12, craft: 3 }, '2026-11-04'), { harvest: 0, craft: 0 });
check('脏计数不负数', quotaUsed({ day: '2026-11-04', harvest: -3, craft: -1 }, '2026-11-04'), { harvest: 0, craft: 0 });
check('浇水次数同日保留 / 跨天归零', [waterUsed({ ...emptyPlot(0), waterDay: '2026-11-04', waterCount: 1 }, '2026-11-04'), waterUsed({ ...emptyPlot(0), waterDay: '2026-11-03', waterCount: 1 }, '2026-11-04')], [1, 0]);
check('上限剩余：12-11=1，超量夹 0', [limitLeft(11, 12), limitLeft(13, 12)], [1, 0]);
check('上限 <=0 视为关闭', [limitLeft(0, 0), limitLeft(0, -2)], [0, 0]);
check('第 12 次后不可再收获', limitLeft(12, GARDEN_FALLBACK.dailyHarvestLimit), 0);

console.log('[4] 开垦价（初始 2 块，可买 4 块）');
{
  const { unlocked, max, costs } = GARDEN_FALLBACK.plots;
  const price = (length) => nextPlotCost(length, unlocked, costs, max);
  check('初始 2 块时下一块 120', price(2), 120);
  check('已买 1 块后 240', price(3), 240);
  check('已买 3 块后 700', price(5), 700);
  check('开满 6 块返回 null', price(6), null);
  check('配置缺价返回 null', nextPlotCost(3, 2, [120], 6), null);
  check('地块数少于初始值不报负价', nextPlotCost(0, 2, costs, max), 120);
}

console.log('[5] 只向前（系统时间回拨不推进生长）');
check('回拨时停在上次水位', forwardNow(T0 - 3600 * 1000, T0), T0);
check('正常前进用墙钟', forwardNow(T0 + 1000, T0), T0 + 1000);
check('脏水位取 0', forwardNow(-5, -9), 0);
check('回拨后连续调用不再前进', forwardNow(T0 - 1000, forwardNow(T0 - 1000, T0)), T0);

console.log('[6] 地块编解码（重排序号、丢弃垃圾、夹紧范围）');
check('空地块形状', emptyPlot(3), { index: 3, cropId: '', plantedAt: 0, readyAt: 0, waterDay: '', waterCount: 0 });
{
  const rows = decodeGarden([
    null,
    { cropId: 'mint', plantedAt: T0, readyAt: T0 + 1, waterDay: '2026-11-04', waterCount: 500 },
    'oops',
    { cropId: 7, plantedAt: -1, readyAt: 'x', waterDay: 3, waterCount: -2 },
  ]);
  check('只保留对象并重排 index', rows.map((row) => row.index), [0, 1]);
  check('浇水计数夹到 99', rows[0].waterCount, 99);
  check('脏字段回落', [rows[1].cropId, rows[1].plantedAt, rows[1].readyAt, rows[1].waterDay, rows[1].waterCount], ['', 0, 0, '', 0]);
  check('非数组回落空', decodeGarden('nope'), []);
}
check('每日计数脏档归零', decodeGardenQuota({ day: 5, harvest: -1, craft: 1.9 }), { day: '', harvest: 0, craft: 1 });
check('每日计数空值', decodeGardenQuota(null), { day: '', harvest: 0, craft: 0 });

console.log('[7] 配置文件与内置兜底同值（防漂移）');
{
  const garden = readJson('../assets/bundles/cases/config/garden.json');
  check('plots 与兜底一致', [garden.plots.unlocked, garden.plots.max, garden.plots.costs], [GARDEN_FALLBACK.plots.unlocked, GARDEN_FALLBACK.plots.max, GARDEN_FALLBACK.plots.costs]);
  check('water 与兜底一致', [garden.water.minutesSaved, garden.water.dailyLimitPerPlot, garden.water.costCoins], [GARDEN_FALLBACK.water.minutesSaved, GARDEN_FALLBACK.water.dailyLimitPerPlot, GARDEN_FALLBACK.water.costCoins]);
  check('每日收获上限一致', garden.dailyHarvestLimit, GARDEN_FALLBACK.dailyHarvestLimit);
  check('三种草药与兜底一致', garden.crops, GARDEN_FALLBACK.crops);

  const recipes = readJson('../assets/bundles/cases/config/recipes.json');
  check('每日合成上限一致', recipes.dailyCraftLimit, RECIPE_FALLBACK.dailyCraftLimit);
  check('配方 id 与兜底一致', recipes.recipes.map((item) => item.id), RECIPE_FALLBACK.recipes.map((item) => item.id));
  const deworm = recipes.recipes.find((item) => item.id === 'deworm_drops');
  // 表里 material 写成 [{ herb_x: n }]，与 RecipeConfig.ingredientsOf 单键对象读法对齐。
  check('驱虫药剂 = 猫薄荷2 + 薄荷1（工本 40）',
    [Object.entries(Object.assign({}, ...deworm.ins)), deworm.out, deworm.outQty, deworm.coins],
    [[['herb_catnip', 2], ['herb_mint', 1]], 'item_deworm', 1, 40]);
}

console.log('[8] 草药只进 items，不换金币/爱心');
{
  const recipes = readJson('../assets/bundles/cases/config/recipes.json');
  const herbs = GARDEN_FALLBACK.crops.map((crop) => `herb_${crop.id}`);
  const used = recipes.recipes.flatMap((recipe) => recipe.ins.flatMap((group) => Object.keys(group)));
  check('配方材料全部是已知草药', used.every((item) => herbs.includes(item)), true);
  check('产出全部是 item_ 道具', recipes.recipes.every((recipe) => recipe.out.startsWith('item_')), true);
  check('没有任何金币/爱心产出', recipes.recipes.some((recipe) => /coin|heart|gold/i.test(recipe.out)), false);
}

console.log(failures === 0 ? `\n全部通过（0 项失败）` : `\n${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
