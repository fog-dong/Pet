// STATUS: implemented, W25 P2-D 送养纯函数回归（通过率/感谢金/世代衰减/编解码/M1 M2 计数）
// 用法：node --experimental-strip-types --no-warnings scripts/verify-rehome.js
import { readFileSync } from 'node:fs';
import { REHOME_FALLBACK } from '../assets/scripts/config/RehomeDefaults.ts';
import { decodeRehome, emptyRehome, isRehomed, liveAdopted } from '../assets/scripts/cache/RehomeCodec.ts';
import { careScore, generationScale, passRate, thanksCoins } from '../assets/scripts/game/RehomeRules.ts';

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

const RATE = REHOME_FALLBACK.rate;
const FULL = { hunger: 100, cleanliness: 100, mood: 100 };
const ZERO = { hunger: 0, cleanliness: 0, mood: 0 };
const MID = { hunger: 50, cleanliness: 50, mood: 50 };

console.log('[1] 照护度 → 通过率（0.55 ~ 0.95，公式线性）');
check('满属性照护度 = 1', careScore(FULL), 1);
check('零属性照护度 = 0', careScore(ZERO), 0);
check('均值 50 = 0.5', careScore(MID), 0.5);
check('照护度 0 → 下限 0.55', passRate(0, RATE), 0.55);
check('照护度 1 → 上限 0.95', passRate(1, RATE), 0.95);
check('照护度 0.5 → 0.75', passRate(0.5, RATE), 0.75);
check('照护度超界夹到区间内', [passRate(-1, RATE), passRate(2, RATE)], [0.55, 0.95]);
check('配置写反也按低-高纠正', passRate(0.5, { min: 0.9, max: 0.4 }), 0.65);

console.log('[2] 感谢金 = (档位基础 + 好感加成) × 世代衰减');
check('普通档首只 = 600', thanksCoins(600, 0, 0, REHOME_FALLBACK), 600);
check('稀有档首只 = 1200', thanksCoins(1200, 0, 0, REHOME_FALLBACK), 1200);
check('传说档首只 = 2400', thanksCoins(2400, 0, 0, REHOME_FALLBACK), 2400);
check('好感 50 → +200', thanksCoins(600, 50, 0, REHOME_FALLBACK), 800);
check('好感加成封顶 400', [thanksCoins(600, 100, 0, REHOME_FALLBACK), thanksCoins(600, 999, 0, REHOME_FALLBACK)], [1000, 1000]);
check('第二只 ×0.8', thanksCoins(600, 0, 1, REHOME_FALLBACK), 480);
check('第三只 ×0.64 四舍五入', thanksCoins(600, 0, 2, REHOME_FALLBACK), 384);
check('衰减到 0.25 封底', generationScale(50, REHOME_FALLBACK.generation), 0.25);
check('封底后感谢金不为 0', thanksCoins(600, 0, 50, REHOME_FALLBACK), 150);

console.log('[3] 存档编解码（老档无字段、脏值、重复 id）');
check('空值回落空表', decodeRehome(null), emptyRehome());
check('脏数组只留字符串并去重', decodeRehome({ rehomed: ['a', 1, 'a', '', 'b'] }).rehomed, ['a', 'b']);
check('审核记录缺 petId → null', decodeRehome({ review: { readyAt: 100 } }).review, null);
check('审核 rate 夹到 0-1', decodeRehome({ review: { petId: 'a', readyAt: 5, rate: 9 } }).review.rate, 1);
check('审核 readyAt 取非负整数', decodeRehome({ review: { petId: 'a', readyAt: -3, rate: 0.6 } }).review.readyAt, 0);

console.log('[4] M1 小屋过滤 / M2 领养位计数');
check('rehomed 命中即为已送走', [isRehomed({ rehomed: ['a'] }, 'a'), isRehomed({ rehomed: ['a'] }, 'b')], [true, false]);
check('3 只领养送走 1 只 → 占位 2', liveAdopted(['a', 'b', 'c'], { rehomed: ['b'] }), 2);
check('图鉴保留但占位不为负', liveAdopted(['a'], { rehomed: ['a', 'x'] }), 0);

console.log('[5] 配置表与内置兜底逐项一致');
const file = readJson('../assets/bundles/cases/config/rehome.json');
check('cost 一致', file.cost, REHOME_FALLBACK.cost);
check('reviewMs = 30 分钟', file.reviewMs, REHOME_FALLBACK.reviewMs);
check('rate 一致', file.rate, REHOME_FALLBACK.rate);
check('thanks 一致', file.thanks, REHOME_FALLBACK.thanks);
check('affection 一致', file.affection, REHOME_FALLBACK.affection);
check('generation 一致', file.generation, REHOME_FALLBACK.generation);

if (failures > 0) {
  console.log(`\n${failures} 项失败`);
  process.exit(1);
}
console.log('\n全部通过（0 项失败）');
