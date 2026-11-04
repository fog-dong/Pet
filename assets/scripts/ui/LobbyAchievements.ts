// STATUS: implemented, W25 P2-B2 大厅成就编排（称号条挂载 + 回厅里程碑检查；抽离自 Lobby 守行数）
import type { Node } from 'cc';
import { COPY, fillCopy } from '../config/CopyText';
import { tierLabel } from '../game/AchievementText';
import { takeNewlyClaimable } from '../game/AchievementWatch';
import { isAchievementOpen, openAchievementPanel } from './AchievementPanel';
import { mountAchievementTitle } from './AchievementTitle';
import { isGachaOpen } from './GachaPanel';
import { showMilestone } from './MilestonePopup';

export interface LobbyAchievementsHandle {
  refresh(): void;
  check(): void;
}

/**
 * 每次进厅跑一次 check：与上次进厅的可领集合对比，新出现的档位弹里程碑。
 * 盲盒或成就面板开着时不弹，避免遮住玩家正在操作的层。
 */
export function mountLobbyAchievements(parent: Node, changed: () => void): LobbyAchievementsHandle {
  const title = mountAchievementTitle(parent, () => openAchievementPanel(parent, changed));
  return {
    refresh: title.refresh,
    check: () => {
      if (isGachaOpen() || isAchievementOpen()) {
        return;
      }
      const fresh = takeNewlyClaimable();
      if (fresh.length === 0) {
        return;
      }
      title.refresh();
      showMilestone(parent, {
        title: COPY.milestoneTitle,
        lines: fresh.slice(0, 4).map((notice) => tierLabel(notice.group, notice.tier.index)),
        hint: fillCopy(COPY.milestoneHint, { n: fresh.length }),
        go: { text: COPY.milestoneGo, onClick: () => openAchievementPanel(parent, changed) },
        closeText: COPY.milestoneLater,
      });
    },
  };
}
