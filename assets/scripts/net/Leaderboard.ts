// STATUS: implemented, W7 排行榜分页读取（好友榜服务端暂为空壳）
// API: fetchLeaderboard, see docs/plan/接口冻结清单.md §2.5
import { Net } from './Net';

export type LeaderboardType = 'reputation' | 'collection' | 'weekly' | 'friends';

export interface LeaderboardEntry {
  rank: number;
  displayId: string;
  score: number;
  nickname?: string;
}

export interface LeaderboardPage {
  entries: LeaderboardEntry[];
  self: LeaderboardEntry | null;
  total: number;
  page: number;
  pageSize: number;
}

interface LeaderboardPayload {
  entries?: unknown;
  self?: unknown;
  total?: unknown;
  page?: unknown;
  pageSize?: unknown;
}

const DEFAULT_PAGE_SIZE = 5;

/**
 * W33 P0-4：后端排行榜集合还没有任何写入，入口开着只会给一个恒空页。
 * 先下架（成就 TAB 不渲染按钮）；服务端接好写入并验证有数后改回 true 即恢复。
 */
export const LEADERBOARD_ENTRY_VISIBLE = false;

function toEntry(value: unknown): LeaderboardEntry | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.rank !== 'number' || typeof row.displayId !== 'string' || typeof row.score !== 'number') {
    return null;
  }
  return {
    rank: row.rank,
    displayId: row.displayId,
    score: row.score,
    nickname: typeof row.nickname === 'string' ? row.nickname : undefined,
  };
}

export async function fetchLeaderboard(
  type: LeaderboardType,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<LeaderboardPage | null> {
  const response = await Net.call<LeaderboardPayload>('leaderboard', { type, page, pageSize });
  if (response.code !== 0 || !response.data) {
    return null;
  }
  const data = response.data;
  const entries = Array.isArray(data.entries)
    ? data.entries.map(toEntry).filter((entry): entry is LeaderboardEntry => entry !== null)
    : [];
  return {
    entries,
    self: toEntry(data.self),
    total: typeof data.total === 'number' ? data.total : entries.length,
    page: typeof data.page === 'number' ? data.page : page,
    pageSize: typeof data.pageSize === 'number' ? data.pageSize : pageSize,
  };
}
