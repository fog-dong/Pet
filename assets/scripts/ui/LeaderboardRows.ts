// STATUS: implemented, W16 排行榜行渲染（内容锚点置顶，行高固定，超出交给 ScrollView）
import { Node } from 'cc';
import { LeaderboardPage } from '../net/Leaderboard';
import { addLabel, PALETTE } from './SceneUI';

const AUTHORED_PANEL_W = 900;
const DEFAULT_ROW_H = 56;

/** 有数据画名次行，无数据画一句空状态；内容锚点在顶部，第 0 行居中于 -ROW_H/2。 */
export function renderLeaderboardRows(
  content: Node,
  previous: Node | null,
  data: LeaderboardPage | null,
  empty: string,
  panelW = AUTHORED_PANEL_W,
  rowH = DEFAULT_ROW_H,
): Node {
  const k = panelW / AUTHORED_PANEL_W;
  previous?.destroy();
  const rows = new Node('LeaderboardRows');
  rows.parent = content;
  if (!data || data.entries.length === 0) {
    addLabel(rows, 'LeaderboardEmpty', empty, -rowH, { size: 26, color: PALETTE.sub, width: 760 * k });
    return rows;
  }
  data.entries.forEach((entry, index) => {
    const y = -(index + 0.5) * rowH;
    addLabel(rows, `LB_Rank${index}`, `#${entry.rank}`, y, { size: 26, width: 120, x: -310 * k });
    addLabel(rows, `LB_Name${index}`, entry.nickname ?? entry.displayId, y, { size: 24, width: 420 * k, x: -40 * k });
    addLabel(rows, `LB_Score${index}`, `${entry.score}`, y, { size: 24, width: 160, x: 290 * k });
  });
  return rows;
}
