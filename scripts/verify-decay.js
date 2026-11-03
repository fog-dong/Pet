// STATUS: implemented, W22-4 衰减与阶段倍率回归（纯函数，不开浏览器）
// 用法：node --experimental-strip-types --no-warnings scripts/verify-decay.js
// 断言 W20 方案 §2.2 基准速率 + §2.2.1 阶段倍率 + 老年小毛病的确定性触发。
import {
  AILMENT_HEART_COST,
  MAX_SETTLE_HOURS,
  STAGE_MOOD_GAIN,
  ailmentCost,
  applyDecay,
  elapsedDecayHours,
  floatTextOf,
  statDelta,
} from '../assets/scripts/game/HabitatDecay.ts';
import { HABITAT_RULES } from '../assets/scripts/game/HabitatRules.ts';
import { clampStat } from '../assets/scripts/cache/HabitatCodec.ts';

let failures = 0;

function check(title, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures += 1;
  }
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${title} → ${JSON.stringify(actual)}${ok ? '' : ' 期望 ' + JSON.stringify(expected)}`);
}

const HOUR = 3600 * 1000;
const T0 = 1762147200000;

function pet(overrides) {
  return {
    petId: 'pet_golden',
    hunger: 70,
    cleanliness: 70,
    mood: 70,
    birthTimestamp: T0 - 100 * 24 * HOUR,
    lastDecayAt: T0,
    soothedDay: '',
    ...overrides,
  };
}

/** 与 HabitatModel.settleDecay 同一段编排：先按水位算该补几小时，再补算并前移水位。 */
function settle(entry, stage, now) {
  const hours = elapsedDecayHours(entry.lastDecayAt, now);
  if (hours > 0) {
    applyDecay(entry, stage, hours, clampStat);
  }
  return hours;
}

/** 补算 hours 小时后返回三项属性，便于逐档对照。 */
function after(entry, stage, hours) {
  settle(entry, stage, T0 + hours * HOUR);
  return [entry.hunger, entry.cleanliness, entry.mood];
}

console.log('[1] §2.2 基准速率（成年档 = 文档原值）');
check('成年 1h：hunger-6 / clean-4 / mood-5', after(pet(), 'adult', 1), [64, 66, 65]);
check('幼年 1h：hunger ×1.5、mood ×1.2、清洁不加速', after(pet(), 'baby', 1), [61, 66, 64]);
check('老年 1h：衰减与成年同速（只削收益不加速）', after(pet(), 'senior', 1), [64, 66, 65]);

console.log('[2] 低值联动（hunger 或 cleanliness < 30 → 心情额外 -10/h）');
check('成年 + 饥饿 20：心情 -15', after(pet({ hunger: 20 }), 'adult', 1), [14, 66, 55]);
check('幼年 + 脏 20：心情按 (5×1.2 + 10) 扣', after(pet({ cleanliness: 20 }), 'baby', 1), [61, 16, 54]);

console.log('[3] 水位推进与上限夹紧');
{
  const entry = pet();
  check('不足 1 小时不扣、水位不动', [settle(entry, 'adult', T0 + 30 * 60 * 1000), entry.lastDecayAt], [0, T0]);
  settle(entry, 'adult', T0 + 90 * 60 * 1000);
  check('水位按整小时推进（零头留到下次）', entry.lastDecayAt, T0 + HOUR);
  const long = pet();
  check(`长期未上线最多补算 ${MAX_SETTLE_HOURS} 小时`, settle(long, 'adult', T0 + 24 * 7 * HOUR), MAX_SETTLE_HOURS);
  check('补算后水位 = 起点 + 24h', long.lastDecayAt, T0 + MAX_SETTLE_HOURS * HOUR);
  check('属性夹到 0 不为负', [long.hunger, long.cleanliness, long.mood], [0, 0, 0]);
  check('水位在未来不追溯', settle(pet({ lastDecayAt: T0 + 5 * HOUR }), 'adult', T0), 0);
  const twice = pet();
  settle(twice, 'adult', T0 + 5 * HOUR);
  const once = [twice.hunger, twice.cleanliness, twice.mood];
  check('同一时刻重复进屋不再扣第二次', [settle(twice, 'adult', T0 + 5 * HOUR), once].flat(), [0, ...once]);
}

console.log('[4] 阶段影响互动收益（模块三，基准值按 2026-11-03 决策-4）');
check('幼年抚摸收益不打折', statDelta(HABITAT_RULES.pet, 'baby'), 10);
check('成年抚摸 = 基准 10', statDelta(HABITAT_RULES.pet, 'adult'), 10);
check('老年抚摸减半（10×0.5）', statDelta(HABITAT_RULES.pet, 'senior'), 5);
check('喂食/高级粮/洗澡的饱食清洁收益不受心情倍率影响', [
  statDelta(HABITAT_RULES.feed, 'senior'),
  statDelta(HABITAT_RULES.premium, 'senior'),
  statDelta(HABITAT_RULES.bath, 'senior'),
], [30, 70, 35]);
check('倍率表只有三档', Object.keys(STAGE_MOOD_GAIN), ['baby', 'adult', 'senior']);
check('飘字按实际收益生成', floatTextOf(HABITAT_RULES.pet, 5), '+5 心情');
check('高级粮飘字写作饱食度 +70', floatTextOf(HABITAT_RULES.premium, 70), '+70 饱食度');

console.log('[5] 老年小毛病：确定性触发、当天只收一次');
{
  const PET_IDS = ['pet_golden', 'pet_ragdoll', 'pet_corgi', 'pet_budgie', 'pet_maine', 'pet_chihuahua',
    'pet_husky', 'pet_tabby_cat', 'pet_poodle', 'pet_calico', 'pet_shiba', 'pet_british',
    'pet_american', 'pet_siamese', 'pet_orange_cat', 'pet_labrador', 'pet_samoyed',
    'pet_collie', 'pet_bichon', 'pet_lop_rabbit'];
  const day = '2026-11-3';
  const senior = pet({ soothedDay: '' });
  check('幼年不触发', ailmentCost(pet(), 'baby', day), 0);
  check('成年不触发', ailmentCost(pet(), 'adult', day), 0);
  check('已安抚过的当天不再收', ailmentCost(pet({ soothedDay: day }), 'senior', day), 0);
  check('缺日期键不收费', ailmentCost(senior, 'senior', ''), 0);
  const struck = (id) => ailmentCost(pet({ petId: id }), 'senior', day);
  check('同一天重进结果一致', [struck('pet_golden'), struck('pet_golden')].every((v) => v === struck('pet_golden')), true);
  const values = [0, AILMENT_HEART_COST];
  check('收费只可能是 0 或安抚价', [struck('pet_golden'), struck('pet_ragdoll')].every((v) => values.includes(v)), true);
  // 浏览器端要复现「今天必扣爱心」，得先在 20 只里挑出一只当天命中的；这里保证这样的样本一定存在。
  const hitSample = PET_IDS.filter((id) => struck(id) === AILMENT_HEART_COST);
  check(`${day} 存在必命中样本（供 verify:habitat 浏览器端复现）`, hitSample.length > 0, true);
  console.log(`     当天命中：${hitSample.join('/')}`);
  // 20 只 × 30 天 = 600 个样本，用于确认概率档位没有跑偏（±10 个百分点容忍）。
  let hits = 0;
  for (let d = 1; d <= 30; d += 1) {
    PET_IDS.forEach((id) => {
      hits += ailmentCost(pet({ petId: id }), 'senior', `2026-11-${d}`) > 0 ? 1 : 0;
    });
  }
  const percent = Math.round((hits / 600) * 100);
  check(`触发率落在 ${percent}%（目标 25%±10）`, percent >= 15 && percent <= 35, true);
  console.log(`     600 个样本命中 ${hits} 次`);
}

console.log('');
console.log(failures === 0 ? '结果：全部通过' : `结果：${failures} 个用例失败`);
process.exit(failures === 0 ? 0 : 1);
