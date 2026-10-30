// STATUS: implemented, W7 排行榜分页（friends 暂无关系链，返回空壳）
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
  page?: unknown;
  pageSize?: unknown;
}

interface LeaderboardEntry {
  rank: number;
  displayId: string;
  score: number;
  nickname?: string;
}

interface LeaderboardData {
  entries: LeaderboardEntry[];
  self: LeaderboardEntry | null;
  total: number;
  page: number;
  pageSize: number;
}

interface LeaderboardRow {
  openid?: string;
  score?: number;
  nickname?: string;
}

const LEADERBOARD_TYPES: readonly string[] = ['reputation', 'collection', 'weekly', 'friends'];
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
function ok<T>(data: T): CloudResponse<T> {
  return { code: 0, msg: 'ok', data, serverTime: Date.now() };
}

function fail<T>(code: number, msg: string): CloudResponse<T> {
  return { code, msg, data: null, serverTime: Date.now() };
}
function readInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function isoWeekKey(date: Date): string {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(target.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((target.getTime() - yearStart) / 86400000 + 1) / 7);
  const padded = week < 10 ? `0${week}` : `${week}`;
  return `${target.getUTCFullYear()}-W${padded}`;
}

/** 不返回 openid 明文，只给脱敏展示 ID。 */
function maskId(openid: string): string {
  return openid.length <= 6 ? 'wx_***' : `${openid.slice(0, 3)}***${openid.slice(-3)}`;
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
  const page = event.page === undefined ? 1 : readInt(event.page);
  if (page === null || page < 1) {
    return fail<LeaderboardData>(1002, 'INVALID_PARAM');
  }

  const requested = event.limit !== undefined ? event.limit : event.pageSize;
  const size = requested === undefined ? DEFAULT_PAGE_SIZE : readInt(requested);
  if (size === null || size < 1 || size > MAX_PAGE_SIZE) {
    return fail<LeaderboardData>(1002, 'INVALID_PARAM');
  }

  const period =
    typeof event.period === 'string'
      ? event.period
      : type === 'weekly'
        ? isoWeekKey(new Date())
        : 'all';

  // 好友榜需要关系链（W8 接入），W7 只保证分页壳与空状态可用。
  if (type === 'friends') {
    return ok<LeaderboardData>({ entries: [], self: null, total: 0, page: 1, pageSize: size });
  }

  const db = cloud.database();
  const filter = { type, period };
  const total = (await db.collection('leaderboard').where(filter).count()).total;
  const offset = (page - 1) * size;
  const rows = (
    await db
      .collection<LeaderboardRow>('leaderboard')
      .where(filter)
      .orderBy('score', 'desc')
      .orderBy('updatedAt', 'asc')
      .skip(offset)
      .limit(size)
      .get()
  ).data;

  const entries = rows.map((row, index) => ({
    rank: offset + index + 1,
    displayId: maskId(typeof row.openid === 'string' ? row.openid : ''),
    score: typeof row.score === 'number' ? row.score : 0,
    nickname: typeof row.nickname === 'string' ? row.nickname : undefined,
  }));

  const mine = (
    await db
      .collection<LeaderboardRow>('leaderboard')
      .where({ type, period, openid: OPENID })
      .limit(1)
      .get()
  ).data[0];
  let self: LeaderboardEntry | null = null;
  if (mine) {
    const score = typeof mine.score === 'number' ? mine.score : 0;
    const ahead = (
      await db
        .collection('leaderboard')
        .where({ type, period, score: db.command.gt(score) })
        .count()
    ).total;
    self = { rank: ahead + 1, displayId: maskId(OPENID), score };
  }

  return ok<LeaderboardData>({ entries, self, total, page, pageSize: size });
}
