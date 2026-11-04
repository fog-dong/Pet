// STATUS: implemented, W25 P2-B1 成就表口径回归（纯函数 + 静态扫描，不开浏览器）
// 用法：node --experimental-strip-types --no-warnings scripts/verify-achievements.js
// 断言：achievements.json 与内置兜底逐项同值、整表校验会拒绝坏表、状态机 locked→claimable→claimed、
//       券口径三处同值，以及 14 个计数器的「已接线 6 / 待接线 8」清单不被悄悄改动。
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ACHIEVEMENT_FALLBACK, TICKET_ITEM } from '../assets/scripts/config/AchievementDefaults.ts';
import { normalizeGroups } from '../assets/scripts/game/AchievementSchema.ts';
import {
  canClaim,
  claimableCount,
  findTier,
  groupView,
  tierId,
} from '../assets/scripts/game/AchievementRules.ts';

let failures = 0;

function check(title, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures += 1;
  }
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${title} → ${JSON.stringify(actual)}${ok ? '' : ' 期望 ' + JSON.stringify(expected)}`);
}

const file = JSON.parse(readFileSync('assets/bundles/cases/config/achievements.json', 'utf8'));
const gacha = JSON.parse(readFileSync('assets/bundles/cases/config/gacha.json', 'utf8'));
const groups = normalizeGroups(file.groups);

console.log(`[0] 配置读取（achievements.json version=${file.version}）`);
check('六组', groups.map((group) => group.id), ['medic', 'grower', 'guardian', 'homework', 'seeker', 'repute']);
check('每组三档', groups.map((group) => group.tiers.length), [3, 3, 3, 3, 3, 3]);
const tierIds = groups.flatMap((group) => group.tiers.map((_, index) => tierId(group.id, index)));
check('档位 id 唯一', new Set(tierIds).size, tierIds.length);
const ascending = groups.every((group) => group.tiers.every((tier, index) => index === 0 || tier.need > group.tiers[index - 1].need));
check('门槛严格递增', ascending, true);
check('JSON 与内置兜底逐项同值', groups, JSON.parse(JSON.stringify(ACHIEVEMENT_FALLBACK)));

console.log('[1] 整表校验：任何坏组都整表回落');
const good = JSON.parse(JSON.stringify(file.groups));
check('非数组 → 回落', normalizeGroups({}), []);
check('空表 → 回落', normalizeGroups([]), []);
check('坏组 → 整表空', normalizeGroups([...good, { id: 'x', name: 'X', metric: 'bad-key', tiers: [{ need: 1 }] }]), []);
check('组 id 重复 → 整表空', normalizeGroups([good[0], good[0]]), []);
check('门槛并列 → 整表空', normalizeGroups([{ id: 'x', name: 'X', metric: 'm', tiers: [{ need: 5 }, { need: 5 }] }]), []);
check('负奖励 → 整表空', normalizeGroups([{ id: 'x', name: 'X', metric: 'm', tiers: [{ need: 5, reward: { coins: -1 } }] }]), []);
check('空档位 → 整表空', normalizeGroups([{ id: 'x', name: 'X', metric: 'm', tiers: [] }]), []);

console.log('[2] 状态机：locked → claimable → claimed');
const medic = groups[0];
const claimedNone = [];
const first = tierId('medic', 0);
check('4 次仍是锁定', groupView(medic, 4, claimedNone).tiers[0].status, 'locked');
check('5 次可领', groupView(medic, 5, claimedNone).tiers[0].status, 'claimable');
check('下一档取第一个未领', groupView(medic, 25, claimedNone).nextNeed, 5);
check('领完三档 nextNeed=null', groupView(medic, 60, ['medic#1', 'medic#2', 'medic#3']).nextNeed, null);
check('领过再判为 claimed', groupView(medic, 60, [first]).tiers[0].status, 'claimed');
check('可领数=2（5/20 达标，50 未到）', claimableCount([groupView(medic, 25, claimedNone)]), 2);
check('canClaim 未达标为 false', canClaim(medic, 2, 49, claimedNone), false);
check('canClaim 达标为 true', canClaim(medic, 2, 50, claimedNone), true);
check('canClaim 已领为 false', canClaim(medic, 0, 50, [first]), false);
check('findTier 命中第三档', findTier(groups, 'medic#3').tier.need, 50);
check('findTier 未命中返回 null', findTier(groups, 'medic#4'), null);
check('findTier 不受 id 里 # 干扰', findTier([{ ...medic, id: 'a#b' }], 'a#b#1').index, 0);

console.log('[3] 券口径三处同值');
check('gacha.ticketItem = TICKET_ITEM', gacha.ticketItem, TICKET_ITEM);
check('gacha.ticketTiers', gacha.ticketTiers, ['rare', 'legendary']);
check('券档位都在抽卡档里', gacha.ticketTiers.every((tier) => gacha.tiers.some((item) => item.tier === tier)), true);
check('悬壶第三档发 1 张券', medic.tiers[2].reward.ticket, 1);

console.log('[4] 计数器覆盖：已接线 6 / 待接线 8');
const counterSource = readFileSync('assets/scripts/game/Counters.ts', 'utf8');
const declared = [...counterSource.matchAll(/^\s{2}(\w+): '\1',$/gm)].map((match) => match[1]);
check('计数器共 14 个', declared.length, 14);
const produced = [];
for (const dir of ['assets/scripts/game', 'assets/scripts/ui']) {
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.ts')) {
      continue;
    }
    for (const match of readFileSync(join(dir, name), 'utf8').matchAll(/bumpCounter\('(\w+)'/g)) {
      if (!produced.includes(match[1])) {
        produced.push(match[1]);
      }
    }
  }
}
check('已接线清单', produced.sort(), ['casePerfect', 'caseTransfer', 'gachaDraws', 'gachaLegendary', 'themeBought', 'wrongMedicine']);
const pending = declared.filter((key) => !produced.includes(key)).sort();
check('待接线清单（P2-C/D 接）', pending, ['craftCount', 'deworm', 'gardenHarvested', 'gardenPlanted', 'herbCount', 'nailCare', 'rehomeCoins', 'rehomeCount']);
check('成就指标都来自已有字段或计数器', groups.every((group) => ['casesDone', 'reputation', ...declared].includes(group.metric)), true);

console.log('');
console.log(failures === 0 ? '结果：全部通过' : `结果：${failures} 个用例失败`);
process.exit(failures === 0 ? 0 : 1);
