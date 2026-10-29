// STATUS: scaffold, API frozen by architect on 2026-10-29
// API: leaderboard, see docs/plan/接口冻结清单.md §2.5
import * as cloud from 'wx-server-sdk';

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

interface CloudResponse<T> {
  code: number;
  msg: string;
  data: T | null;
  serverTime?: number;
}

interface LeaderboardEvent {
  type?: unknown;
  period?: unknown;
  limit?: unknown;
}

interface LeaderboardEntry {
  rank: number;
  displayId: string;
  score: number;
}

interface LeaderboardData {
  entries: LeaderboardEntry[];
  self: LeaderboardEntry | null;
}

const LEADERBOARD_TYPES: readonly string[] = ['reputation', 'collection', 'weekly'];

function ok<T>(data: T): CloudResponse<T> {
  return { code: 0, msg: 'ok', data, serverTime: Date.now() };
}

function fail<T>(code: number, msg: string): CloudResponse<T> {
  return { code, msg, data: null, serverTime: Date.now() };
}

export async function main(event: LeaderboardEvent): Promise<CloudResponse<LeaderboardData>> {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return fail<LeaderboardData>(1001, 'SESSION_INVALID');
  }

  const type = event.type;
  if (typeof type !== 'string' || !LEADERBOARD_TYPES.includes(type)) {
    return fail<LeaderboardData>(1002, 'INVALID_PARAM');
  }

  if (event.period !== undefined && typeof event.period !== 'string') {
    return fail<LeaderboardData>(1002, 'INVALID_PARAM');
  }

  const limit = event.limit;
  if (limit !== undefined && (typeof limit !== 'number' || limit < 1 || limit > 100)) {
    return fail<LeaderboardData>(1002, 'INVALID_PARAM');
  }

  // W2: 查询 leaderboard 的 type + period + score 组合索引，返回前 N 与自己的名次；
  // 不返回 openid 明文，displayId 需脱敏。
  return ok<LeaderboardData>({ entries: [], self: null });
}
