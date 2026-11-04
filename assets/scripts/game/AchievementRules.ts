// STATUS: implemented, W25 P2-B1 成就规则（档位状态 / 下一档 / 领取判定；node --experimental-strip-types 直接回归）
import type { AchievementGroup, AchievementTier } from './AchievementSchema';

export type { AchievementGroup, AchievementReward, AchievementTier } from './AchievementSchema';

export type TierStatus = 'locked' | 'claimable' | 'claimed';

export interface TierView extends AchievementTier {
  /** `<group>#<档位序号>`，落 `achievementsClaimed`。 */
  id: string;
  index: number;
  status: TierStatus;
}

export interface GroupView {
  id: string;
  name: string;
  metric: string;
  value: number;
  /** 下一个未领取档位的门槛；三档全领完为 null。 */
  nextNeed: number | null;
  tiers: TierView[];
}

export interface ClaimTarget {
  group: AchievementGroup;
  index: number;
  tier: AchievementTier;
}

export function tierId(groupId: string, index: number): string {
  return `${groupId}#${index + 1}`;
}

export function statusOf(value: number, tier: AchievementTier, id: string, claimed: readonly string[]): TierStatus {
  if (claimed.includes(id)) {
    return 'claimed';
  }
  return value >= tier.need ? 'claimable' : 'locked';
}

export function groupView(group: AchievementGroup, value: number, claimed: readonly string[]): GroupView {
  const tiers = group.tiers.map((tier, index): TierView => {
    const id = tierId(group.id, index);
    return { ...tier, id, index, status: statusOf(value, tier, id, claimed) };
  });
  const next = tiers.find((tier) => tier.status !== 'claimed');
  return { id: group.id, name: group.name, metric: group.metric, value, nextNeed: next ? next.need : null, tiers };
}

export function claimableCount(views: readonly GroupView[]): number {
  return views.reduce((sum, group) => sum + group.tiers.filter((tier) => tier.status === 'claimable').length, 0);
}

/** 领满一组 = 三档全领，称号按这个数进一阶。 */
export function completedGroups(views: readonly GroupView[]): number {
  return views.filter((group) => group.tiers.every((tier) => tier.status === 'claimed')).length;
}

/** 称号阶梯下标：最后一阶封顶，空成就表停在第一阶。 */
export function titleIndex(views: readonly GroupView[], levels: number): number {
  if (levels <= 0) {
    return 0;
  }
  return Math.min(levels - 1, Math.max(0, completedGroups(views)));
}

/** 按 tier id 找档位：遍历而不是解析字符串，group id 里带 `#` 也不会认错。 */
export function findTier(groups: readonly AchievementGroup[], id: string): ClaimTarget | null {
  for (const group of groups) {
    for (let index = 0; index < group.tiers.length; index += 1) {
      if (tierId(group.id, index) === id) {
        return { group, index, tier: group.tiers[index] };
      }
    }
  }
  return null;
}

/** 领取前置：达成且没领过。入账动作留给 game/Achievements，规则层保持无副作用。 */
export function canClaim(group: AchievementGroup, index: number, value: number, claimed: readonly string[]): boolean {
  const tier = group.tiers[index];
  return !!tier && statusOf(value, tier, tierId(group.id, index), claimed) === 'claimable';
}
