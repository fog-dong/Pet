// STATUS: implemented, W25 P2-B1 成就表兜底（与 achievements.json 逐项同值；缺配回落并 Track 告警，不静默）
import type { AchievementGroup } from '../game/AchievementRules';

/** 盲盒券走已有 `items` 字段；gacha.json 的 `ticketItem` 必须与它一致（校验脚本钉住）。 */
export const TICKET_ITEM = 'item_ticket_rare';

export const ACHIEVEMENT_FALLBACK: readonly AchievementGroup[] = [
  {
    id: 'medic',
    name: '悬壶',
    metric: 'casesDone',
    tiers: [
      { need: 5, reward: { coins: 200 } },
      { need: 20, reward: { coins: 600, hearts: 5 } },
      { need: 50, reward: { coins: 1200, hearts: 12, ticket: 1 } },
    ],
  },
  {
    id: 'grower',
    name: '躬耕',
    metric: 'gardenPlanted',
    tiers: [{ need: 3, reward: {} }, { need: 15, reward: {} }, { need: 40, reward: {} }],
  },
  {
    id: 'guardian',
    name: '照护',
    metric: 'nailCare',
    tiers: [{ need: 3, reward: {} }, { need: 10, reward: {} }, { need: 30, reward: {} }],
  },
  {
    id: 'homework',
    name: '送家有道',
    metric: 'rehomeCount',
    tiers: [{ need: 1, reward: {} }, { need: 5, reward: {} }, { need: 15, reward: {} }],
  },
  {
    id: 'seeker',
    name: '寻访',
    metric: 'gachaDraws',
    tiers: [{ need: 5, reward: {} }, { need: 20, reward: {} }, { need: 60, reward: {} }],
  },
  {
    id: 'repute',
    name: '口碑',
    metric: 'reputation',
    tiers: [{ need: 100, reward: {} }, { need: 300, reward: {} }, { need: 800, reward: {} }],
  },
];
