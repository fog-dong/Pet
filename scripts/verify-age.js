// STATUS: implemented, W22-2 生命周期口径回归（纯函数，不开浏览器）
// 用法：node --experimental-strip-types --no-warnings scripts/verify-age.js
// 断言的是「同一出生时间下，大型犬与长寿猫的阶段/进度确实不同」这条产品口径，
// 数值一律从 assets/bundles/cases/config/pets.json 真读，不在脚本里复制第二套阈值。
import { readFileSync } from 'node:fs';
import {
  DAY_MS,
  getAgeText,
  getLifeProgress,
  getLifeStage,
  lifeSpanOf,
  lifespanText,
} from '../assets/scripts/game/AgeSystem.ts';

let failures = 0;

function check(title, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures += 1;
  }
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${title} → ${JSON.stringify(actual)}${ok ? '' : ' 期望 ' + JSON.stringify(expected)}`);
}

const NOW = 1762147200000;
const bornNDaysAgo = (days) => NOW - days * DAY_MS;
const config = JSON.parse(readFileSync('assets/bundles/cases/config/pets.json', 'utf8'));
const pets = config.pets;
const byId = (petId) => pets.find((item) => item.petId === petId) ?? null;

const GOLDEN = byId('pet_golden');
const RAGDOLL = byId('pet_ragdoll');

console.log(`[0] 配置读取（pets.json version=${config.version}）`);
check('金毛阈值 300/60/200', lifeSpanOf(GOLDEN), { expectedLifespanDays: 300, maturityAgeDays: 60, seniorAgeDays: 200 });
check('布偶阈值 500/150/400', lifeSpanOf(RAGDOLL), { expectedLifespanDays: 500, maturityAgeDays: 150, seniorAgeDays: 400 });

console.log('[1] 20 只全量：阈值顺序 + 同一出生时间能分出不同阶段');
const bad = pets.filter((item) => {
  const s = lifeSpanOf(item);
  return !(s.maturityAgeDays < s.seniorAgeDays && s.seniorAgeDays <= s.expectedLifespanDays);
});
check('阈值顺序全部合法', bad.map((item) => item.petId), []);
check('覆盖 20 只', pets.length, 20);
const stagesAtDay100 = new Set(pets.map((item) => getLifeStage(bornNDaysAgo(100), item, NOW)));
check('第 100 天时 20 只不止一个阶段', [...stagesAtDay100].sort(), ['adult', 'baby']);

console.log('[2] 核心对照：同一天出生，大型犬 vs 长寿猫');
check('金毛 65 天已成年', getLifeStage(bornNDaysAgo(65), GOLDEN, NOW), 'adult');
check('布偶 65 天仍是幼年', getLifeStage(bornNDaysAgo(65), RAGDOLL, NOW), 'baby');
check('金毛 210 天进老年', getLifeStage(bornNDaysAgo(210), GOLDEN, NOW), 'senior');
check('布偶 210 天正当年', getLifeStage(bornNDaysAgo(210), RAGDOLL, NOW), 'adult');
check('年龄文案只跟天数有关', getAgeText(bornNDaysAgo(65), GOLDEN, NOW), getAgeText(bornNDaysAgo(65), RAGDOLL, NOW));
check('金毛 65 天 = 5 岁 5 个月', getAgeText(bornNDaysAgo(65), GOLDEN, NOW), '5 岁 5 个月');
check('同日进度不同', [
  Math.round(getLifeProgress(bornNDaysAgo(65), GOLDEN, NOW) * 1000) / 1000,
  Math.round(getLifeProgress(bornNDaysAgo(65), RAGDOLL, NOW) * 1000) / 1000,
], [0.217, 0.13]);
check('预计寿命文案按展示换算', [lifespanText(GOLDEN), lifespanText(RAGDOLL)], ['预计寿命：25 岁', '预计寿命：42 岁']);

console.log('[3] 阈值边界（左闭右开）');
check('差 1 天成年', getLifeStage(bornNDaysAgo(59), GOLDEN, NOW), 'baby');
check('刚好成年', getLifeStage(bornNDaysAgo(60), GOLDEN, NOW), 'adult');
check('差 1 天老年', getLifeStage(bornNDaysAgo(199), GOLDEN, NOW), 'adult');
check('刚好老年', getLifeStage(bornNDaysAgo(200), GOLDEN, NOW), 'senior');

console.log('[4] 不老不死 + 异常输入兜底');
check('满寿命进度钳在 1', getLifeProgress(bornNDaysAgo(300), GOLDEN, NOW), 1);
check('远超寿命仍是 1', getLifeProgress(bornNDaysAgo(900), GOLDEN, NOW), 1);
check('远超寿命仍是老年而非消失', getLifeStage(bornNDaysAgo(900), GOLDEN, NOW), 'senior');
check('出生时间在未来按 0 天', getLifeStage(bornNDaysAgo(-3), GOLDEN, NOW), 'baby');
check('未来时间进度不为负', getLifeProgress(bornNDaysAgo(-3), GOLDEN, NOW), 0);
check('出生当天文案', getAgeText(NOW, GOLDEN, NOW), '出生当天');
check('满整岁不带月', getAgeText(bornNDaysAgo(24), GOLDEN, NOW), '2 岁');
check('缺配置走兜底档', lifeSpanOf(null), { expectedLifespanDays: 500, maturityAgeDays: 120, seniorAgeDays: 400 });
check('阈值顺序异常整档回落', lifeSpanOf({ maturityAgeDays: 400, seniorAgeDays: 120, expectedLifespanDays: 500 }), {
  expectedLifespanDays: 500, maturityAgeDays: 120, seniorAgeDays: 400,
});
check('NaN 出生时间不报错', getLifeStage(Number.NaN, GOLDEN, NOW), 'baby');

console.log('');
console.log(failures === 0 ? '结果：全部通过' : `结果：${failures} 个用例失败`);
process.exit(failures === 0 ? 0 : 1);
