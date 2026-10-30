// STATUS: implemented, W8 好友助力（主键插入去重 + 单文档 inc 原子计数 + 超限回滚）
// API: assist, see docs/plan/接口冻结清单.md §2.6
import * as cloud from 'wx-server-sdk';

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database({ throwOnNotFound: false });

interface CloudResponse<T> {
  code: number;
  msg: string;
  data: T | null;
  serverTime?: number;
}

interface AssistEvent {
  friendOpenid?: unknown;
  resourceType?: unknown;
  nonce?: unknown;
}

type AssistReason = 'ALREADY_ASSISTED' | 'LIMIT' | 'EXPIRED';

interface AssistData {
  granted: boolean;
  assisted: boolean;
  reason: AssistReason | null;
  dailyCount: number;
  resources: null;
}

interface AssistDailyRow {
  targetId?: string;
  date?: string;
  count?: number;
  createdAt?: number;
  updatedAt?: number;
}

const RESOURCE_TYPES: readonly string[] = ['medicine', 'bed', 'heart'];
/** 06 §6.2：被助力方每日上限 5 次。 */
const TARGET_DAILY_LIMIT = 5;
const ASSIST_LIMIT_CODE = 1005;

function ok<T>(data: T): CloudResponse<T> {
  return { code: 0, msg: 'ok', data, serverTime: Date.now() };
}

function fail<T>(code: number, msg: string): CloudResponse<T> {
  return { code, msg, data: null, serverTime: Date.now() };
}

/** 以北京时间（UTC+8）切日，避免跨时区重复计数。 */
function shanghaiDate(now: number): string {
  return new Date(now + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

function result(granted: boolean, reason: AssistReason | null, dailyCount: number): AssistData {
  return { granted, assisted: granted, reason, dailyCount, resources: null };
}

async function readDaily(dailyId: string): Promise<number> {
  const doc = await db.collection<AssistDailyRow>('assist_daily').doc(dailyId).get();
  return doc.data && typeof doc.data.count === 'number' ? doc.data.count : 0;
}

/** update + inc 对已存在文档是原子的；首次没有文档时补建一次再累加。 */
async function bumpDaily(dailyId: string, targetId: string, date: string): Promise<void> {
  const daily = db.collection<AssistDailyRow>('assist_daily');
  const first = await daily.doc(dailyId).update({
    data: { count: db.command.inc(1), updatedAt: Date.now() },
  });
  if (first.stats.updated > 0) {
    return;
  }
  try {
    await daily.add({
      data: { _id: dailyId, targetId, date, count: 0, createdAt: Date.now() },
    });
  } catch {
    // 并发首次创建：另一个请求已插入计数文档，继续累加即可。
  }
  const retry = await daily.doc(dailyId).update({
    data: { count: db.command.inc(1), updatedAt: Date.now() },
  });
  if (retry.stats.updated === 0) {
    throw new Error('ASSIST_COUNTER_UNAVAILABLE');
  }
}

export async function main(event: AssistEvent): Promise<CloudResponse<AssistData>> {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return fail<AssistData>(1001, 'SESSION_INVALID');
  }

  const helperId = event.friendOpenid;
  if (typeof helperId !== 'string' || helperId.length === 0 || helperId === OPENID) {
    return fail<AssistData>(1002, 'INVALID_PARAM');
  }

  const resourceType = event.resourceType === undefined ? 'heart' : event.resourceType;
  if (typeof resourceType !== 'string' || !RESOURCE_TYPES.includes(resourceType)) {
    return fail<AssistData>(1002, 'INVALID_PARAM');
  }

  const nonce = event.nonce;
  if (typeof nonce !== 'string' || nonce.length === 0) {
    return fail<AssistData>(1002, 'INVALID_PARAM');
  }

  const targetId = OPENID;
  const date = shanghaiDate(Date.now());
  const dailyId = `${targetId}_${date}`;
  const pairId = `${targetId}_${helperId}_${date}`;
  const pairs = db.collection<Record<string, unknown>>('assist_pairs');

  // 第一步：用自定义 _id 插入去重记录，主键冲突即“今日已助力”，不做先查后写。
  try {
    await pairs.add({
      data: { _id: pairId, targetId, helperId, date, resourceType, nonce, createdAt: Date.now() },
    });
  } catch (error: unknown) {
    const existing = await pairs.doc(pairId).get();
    if (existing.data) {
      return ok<AssistData>(result(false, 'ALREADY_ASSISTED', await readDaily(dailyId)));
    }
    throw error;
  }

  // 第二步：单文档 inc 计数；第三步：超过上限删除刚插入的去重记录并回退计数。
  try {
    await bumpDaily(dailyId, targetId, date);
    const dailyCount = await readDaily(dailyId);
    if (dailyCount > TARGET_DAILY_LIMIT) {
      await pairs.doc(pairId).remove();
      await db.collection<AssistDailyRow>('assist_daily').doc(dailyId).update({
        data: { count: db.command.inc(-1), updatedAt: Date.now() },
      });
      return fail<AssistData>(ASSIST_LIMIT_CODE, 'TODAY_ASSIST_LIMIT');
    }
    return ok<AssistData>(result(true, null, dailyCount));
  } catch (error: unknown) {
    await pairs.doc(pairId).remove().catch(() => undefined);
    throw error;
  }
}
