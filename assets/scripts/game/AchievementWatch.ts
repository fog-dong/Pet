// STATUS: implemented, W25 P2-B2 里程碑触发（会话内对比上一次可领集合；不加存档字段，冷启动不补弹历史）
import { achievementViews } from './Achievements';
import type { TierView } from './AchievementRules';

export interface ClaimNotice {
  id: string;
  group: string;
  tier: TierView;
}

/** null = 本次会话还没记录基线：首次进厅只记不弹，避免旧档一次性刷屏。 */
let seen: Set<string> | null = null;

/** 返回自上次调用以来「新变成可领」的档位；已领取的档位不会再次出现。 */
export function takeNewlyClaimable(): ClaimNotice[] {
  const views = achievementViews();
  const current = new Set<string>();
  views.forEach((group) => {
    group.tiers.forEach((tier) => {
      if (tier.status === 'claimable') {
        current.add(tier.id);
      }
    });
  });
  const previous = seen;
  seen = current;
  if (previous === null) {
    return [];
  }
  const fresh: ClaimNotice[] = [];
  views.forEach((group) => {
    group.tiers.forEach((tier) => {
      if (tier.status === 'claimable' && !previous.has(tier.id)) {
        fresh.push({ id: tier.id, group: group.name, tier });
      }
    });
  });
  return fresh;
}
