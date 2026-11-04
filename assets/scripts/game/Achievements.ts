// STATUS: implemented, W25 P2-B1 成就读取与领取门面（条件只读计数器，奖励一次原子入账）
import { Save } from '../cache/Save';
import { AchievementConfig } from '../config/AchievementConfig';
import { Track } from '../track/Track';
import { canClaim, claimableCount, findTier, GroupView, groupView } from './AchievementRules';

export interface ClaimResult {
  /** missing=表里没有该档，locked=没达标，already=领过了。 */
  outcome: 'claimed' | 'already' | 'locked' | 'missing';
  coins: number;
  hearts: number;
  ticket: number;
}

const EMPTY: ClaimResult = { outcome: 'missing', coins: 0, hearts: 0, ticket: 0 };

/** 指标取值：病例数与口碑复用已有存档字段，其余读 counters（旧档缺 key 按 0）。 */
export function metricValue(metric: string): number {
  Save.load();
  const data = Save.snapshot();
  if (metric === 'casesDone') {
    return data.casesDone;
  }
  if (metric === 'reputation') {
    return data.reputation;
  }
  return data.counters[metric] ?? 0;
}

export function achievementViews(): GroupView[] {
  Save.load();
  const claimed = Save.snapshot().achievementsClaimed;
  return AchievementConfig.list.map((group) => groupView(group, metricValue(group.metric), claimed));
}

/** 大厅红点用：当前可领未领的档位总数。 */
export function claimableAchievements(): number {
  return claimableCount(achievementViews());
}

/**
 * 金币/爱心/券与领取记录在同一次 mutate 里落盘：中途崩溃不会出现「奖励已到账但档位还能再领」。
 * 失败分支只读不写，UI 直接拿 coins/hearts/ticket 做提示。
 */
export function claimAchievement(id: string): ClaimResult {
  Save.load();
  const target = findTier(AchievementConfig.list, id);
  if (!target) {
    return EMPTY;
  }
  const data = Save.snapshot();
  if (data.achievementsClaimed.includes(id)) {
    return { ...EMPTY, outcome: 'already' };
  }
  if (!canClaim(target.group, target.index, metricValue(target.group.metric), data.achievementsClaimed)) {
    return { ...EMPTY, outcome: 'locked' };
  }
  const reward = target.tier.reward;
  const coins = reward.coins ?? 0;
  const hearts = reward.hearts ?? 0;
  const ticket = reward.ticket ?? 0;
  const ticketItem = AchievementConfig.ticketItem;
  Save.mutate((save) => {
    save.coins += coins;
    save.hearts += hearts;
    if (ticket > 0) {
      save.items[ticketItem] = (save.items[ticketItem] ?? 0) + ticket;
    }
    save.achievementsClaimed.push(id);
  });
  Track.track('achievement_claim', { id, coins, hearts, ticket });
  return { outcome: 'claimed', coins, hearts, ticket };
}
