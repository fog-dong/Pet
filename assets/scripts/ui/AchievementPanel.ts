// STATUS: implemented, W25 P2-B2 成就面板（单例：打开读最新档位，领取后整表重绘并弹庆祝）
import { Node } from 'cc';
import { COPY, fillCopy } from '../config/CopyText';
import { achievementViews, claimAchievement } from '../game/Achievements';
import { completedGroups } from '../game/AchievementRules';
import { rewardText, tierLabel, titleFor } from '../game/AchievementText';
import { Track } from '../track/Track';
import { AchievementChrome, buildAchievementChrome } from './AchievementKit';
import { renderAchievementRows } from './AchievementRows';
import { showMilestone } from './MilestonePopup';

let chrome: AchievementChrome | null = null;
let rows: Node | null = null;
let onChanged: (() => void) | null = null;

export function isAchievementOpen(): boolean {
  return !!chrome && chrome.overlay.isValid;
}

/** changed 由大厅传入：领奖后金币/爱心与称号条要跟着刷，面板本身不碰外部节点。 */
export function openAchievementPanel(parent: Node, changed?: () => void): void {
  if (isAchievementOpen()) {
    return;
  }
  onChanged = changed ?? null;
  chrome = buildAchievementChrome(parent, closeAchievementPanel);
  Track.track('achievement_open');
  refresh();
}

export function closeAchievementPanel(): void {
  if (chrome && chrome.overlay.isValid) {
    chrome.overlay.destroy();
  }
  chrome = null;
  rows = null;
  onChanged = null;
}

function refresh(): void {
  if (!chrome || !chrome.overlay.isValid) {
    return;
  }
  const views = achievementViews();
  const title = fillCopy(COPY.achievementEntry, { title: titleFor(views) });
  const done = fillCopy(COPY.achievementGroupsDone, { done: completedGroups(views), total: views.length });
  chrome.titleText.string = `${title}　${done}`;
  chrome.hint.string = '';
  rows = renderAchievementRows(chrome.rowHost, rows, views, claim);
}

/** 档位名要在领取前抓：领取后视图就变成 claimed，拿不到这一档的门槛与分组名。 */
function claim(id: string): void {
  const views = achievementViews();
  const group = views.find((item) => item.tiers.some((tier) => tier.id === id));
  const tier = group?.tiers.find((item) => item.id === id);
  const result = claimAchievement(id);
  if (!chrome) {
    return;
  }
  if (result.outcome !== 'claimed' || !group || !tier) {
    chrome.hint.string = result.outcome === 'already' ? COPY.achievementAlready : COPY.achievementLockedToast;
    return;
  }
  const reward = rewardText(tier.reward);
  refresh();
  chrome.hint.string = fillCopy(COPY.achievementClaimToast, { reward });
  onChanged?.();
  showMilestone(chrome.overlay, {
    title: COPY.achievementClaimTitle,
    lines: [tierLabel(group.name, tier.index), reward],
    closeText: COPY.milestoneOk,
  });
}
