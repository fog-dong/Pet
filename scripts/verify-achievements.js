// STATUS: implemented, W25 P2-B1 成就表口径回归（纯函数 + 静态扫描，不开浏览器）
// 用法：node --experimental-strip-types --no-warnings --import ./scripts/ts-resolve.mjs scripts/verify-achievements.js
// 断言：achievements.json 与内置兜底逐项同值、整表校验会拒绝坏表、状态机 locked→claimable→claimed、
//       券口径三处同值、称号阶梯按领满组数进档且末阶封顶、里程碑专名覆盖全部成就组，以及 14 个计数器全部接线（P2-C/D 已补齐）。
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ACHIEVEMENT_FALLBACK, TICKET_ITEM } from '../assets/scripts/config/AchievementDefaults.ts';
import { COPY, MILESTONE_NAMES } from '../assets/scripts/config/CopyText.ts';
import { milestoneName, tierLabel } from '../assets/scripts/game/AchievementText.ts';
import { normalizeGroups } from '../assets/scripts/game/AchievementSchema.ts';
import {
  canClaim,
  claimableCount,
  completedGroups,
  findTier,
  groupView,
  tierId,
  titleIndex,
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

console.log('[4] 计数器覆盖：已接线 14 / 待接线 0');
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
check('已接线清单', produced.sort(), ['casePerfect', 'caseTransfer', 'craftCount', 'deworm', 'gachaDraws', 'gachaLegendary', 'gardenHarvested', 'gardenPlanted', 'herbCount', 'nailCare', 'rehomeCoins', 'rehomeCount', 'themeBought', 'wrongMedicine']);
const pending = declared.filter((key) => !produced.includes(key)).sort();
check('待接线清单（P2-C/D 已全部接线）', pending, []);
check('成就指标都来自已有字段或计数器', groups.every((group) => ['casesDone', 'reputation', ...declared].includes(group.metric)), true);

console.log('[5] 称号阶梯：领满组数进档，末阶封顶');
const titles = COPY.achievementTitles;
check('称号共 7 阶（首阶 / 末阶）', [titles.length, titles[0], titles[titles.length - 1]], [7, '实习医生', '华佗再世']);
const full = ['medic#1', 'medic#2', 'medic#3'];
check('三档全领算 1 组', completedGroups([groupView(medic, 60, full)]), 1);
check('只领两档不算整组', completedGroups([groupView(medic, 60, full.slice(0, 2))]), 0);
check('空成就表停在首阶', titleIndex([], titles.length), 0);
check('领满 1 组进一阶', titleIndex([groupView(medic, 60, full)], titles.length), 1);
check('只有两阶时 1 组即封顶', titleIndex([groupView(medic, 60, full)], 2), 1);
check('levels=0 不越界', titleIndex([groupView(medic, 60, full)], 0), 0);
const seven = Array.from({ length: 7 }, (_, index) => {
  const id = `g${index}`;
  return groupView({ ...medic, id }, 60, ['#1', '#2', '#3'].map((suffix) => id + suffix));
});
check('领满 7 组封顶末阶', titleIndex(seven, titles.length), 6);

console.log('[6] 里程碑专名：每档有身份，不再读成「一档二档三档」');
check('六个成就组各配三名', groups.map((group) => MILESTONE_NAMES[group.id]?.length), [3, 3, 3, 3, 3, 3]);
check('悬壶三名递进', MILESTONE_NAMES.medic, ['实习兽医', '初掌药柜', '妙手仁心']);
check('送养三名递进', MILESTONE_NAMES.homework, ['临时铲屎官', '金牌领航员', '温暖中转站']);
check('专名不重复所在组名（弹窗串「悬壶 · 悬壶初成」这种不写）', groups.every((group) => MILESTONE_NAMES[group.id].every((name) => !name.includes(group.name))), true);
check('档位串是「组名 · 专名」', [tierLabel('medic', '悬壶', 2), tierLabel('seeker', '寻访', 0)], ['悬壶 · 妙手仁心', '寻访 · 街角探路']);
check('表外组回落档位序号（先加配置后补文案也不崩）', [milestoneName('unknown', 0), milestoneName('unknown', 3)], ['一档', '4']);
check('专名最长 5 字（成就胶囊字号少缩一档）', Math.max(...Object.values(MILESTONE_NAMES).flat().map((name) => name.length)), 5);
check('专名不与称号阶梯重名', Object.values(MILESTONE_NAMES).flat().filter((name) => titles.includes(name)), []);

console.log('');
console.log(failures === 0 ? '结果：全部通过' : `结果：${failures} 个用例失败`);
process.exit(failures === 0 ? 0 : 1);
