// STATUS: implemented, W26 P2-E 成就 TAB：称号条 + 领满进度 + 可领数，成就谱面板与排行榜/图鉴入口
// 成就档位与领奖一律走 game/Achievements，坞这边只读视图，不碰计数器。
import { Label, Node } from 'cc';
import { achievementViews } from '../game/Achievements';
import { claimableCount, completedGroups } from '../game/AchievementRules';
import { titleFor } from '../game/AchievementText';
import { COPY, fillCopy } from '../config/CopyText';
import { addDockEntry, addDockPills, addDockSubs, DockBody, DockContext } from './DockKit';
import { openAchievementPanel } from './AchievementPanel';

const ENTRY_TEXT = '成 就 谱';

export function buildAchieveBody(parent: Node, ctx: DockContext): DockBody {
  const pills = addDockPills(parent, ['', '', ''], 0, ctx.width);
  addDockEntry(parent, 'AchievementButton', ENTRY_TEXT, () => openAchievementPanel(ctx.host, ctx.changed), 1, ctx.width);
  addDockSubs(
    parent,
    [
      { name: 'LeaderboardButton', text: '排行榜', onClick: () => ctx.menu('LeaderboardButton') },
      { name: 'CodexButton', text: '图 鉴', onClick: () => ctx.menu('CodexButton') },
    ],
    2,
    ctx.width,
  );
  return { node: parent, refresh: () => paintPills(pills) };
}

/** 称号与右上角胶囊同源（同一个 titleFor），差别在这里给的是「领满进度 + 可领数」，看得更全。 */
function paintPills(pills: readonly Label[]): void {
  const views = achievementViews();
  const open = claimableCount(views);
  const texts = [
    fillCopy(COPY.achievementEntry, { title: titleFor(views) }),
    fillCopy(COPY.achievementGroupsDone, { done: completedGroups(views), total: views.length }),
    open > 0 ? `可领 ${open}` : '暂无可领',
  ];
  pills.forEach((pill, index) => {
    pill.string = texts[index] ?? '';
  });
}
