// STATUS: implemented, W25 P2-B2 成就展示文案（称号阶梯 / 奖励串 / 档位名；纯函数，node 可直接回归）
import { COPY, fillCopy } from '../config/CopyText';
import type { GroupView } from './AchievementRules';
import { titleIndex } from './AchievementRules';

export function titleFor(views: readonly GroupView[]): string {
  const titles = COPY.achievementTitles;
  return titles[titleIndex(views, titles.length)];
}

/** 奖励串只拼真发到手的项：没有券的档位不会出现「+0 张稀有券」。 */
export function rewardText(reward: { coins?: number; hearts?: number; ticket?: number }): string {
  const parts: string[] = [];
  if (reward.coins) {
    parts.push(fillCopy(COPY.achievementRewardCoins, { coins: reward.coins }));
  }
  if (reward.hearts) {
    parts.push(fillCopy(COPY.achievementRewardHearts, { hearts: reward.hearts }));
  }
  if (reward.ticket) {
    parts.push(fillCopy(COPY.achievementRewardTicket, { n: reward.ticket }));
  }
  return parts.join('　');
}

export function tierLabel(groupName: string, index: number): string {
  return fillCopy(COPY.achievementTierName, { name: groupName, n: COPY.achievementTierNames[index] ?? index + 1 });
}
