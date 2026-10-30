// STATUS: implemented, W9-4 排行榜行渲染（从 LeaderboardPanel 拆出，保持单文件 ≤150 行）
import { Node } from 'cc';
import { LeaderboardPage } from '../net/Leaderboard';
import { addLabel, PALETTE } from './SceneUI';

const ROW_TOP = 110;
const ROW_GAP = 56;

/** 有数据画名次行，无数据画一句空状态；返回新的行容器，供调用方下次替换。 */
export function renderLeaderboardRows(
  panel: Node,
  previous: Node | null,
  data: LeaderboardPage | null,
  empty: string,
): Node {
  previous?.destroy();
  const rows = new Node('LeaderboardRows');
  rows.parent = panel;
  if (!data || data.entries.length === 0) {
    addLabel(rows, 'LeaderboardEmpty', empty, 20, { size: 28, color: PALETTE.sub, width: 760 });
    return rows;
  }
  data.entries.forEach((entry, index) => {
    const y = ROW_TOP - index * ROW_GAP;
    addLabel(rows, `LB_Rank${index}`, `#${entry.rank}`, y, { size: 28, width: 120, x: -320 });
    addLabel(rows, `LB_Name${index}`, entry.nickname ?? entry.displayId, y, { size: 26, width: 420, x: -40 });
    addLabel(rows, `LB_Score${index}`, `${entry.score}`, y, { size: 26, width: 160, x: 300 });
  });
  return rows;
}
