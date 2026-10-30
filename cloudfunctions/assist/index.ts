// STATUS: implemented, W7 好友助力（目标 = 当前 openid，好友 = 客户端占位 ID；幂等 + 每日限次）
// API: assist, see docs/plan/接口冻结清单.md §2.6
import * as cloud from 'wx-server-sdk';

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

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

interface AssistLogRow {
  helperId?: string;
  targetId?: string;
  date?: string;
}

const RESOURCE_TYPES: readonly string[] = ['medicine', 'bed', 'heart'];
/** 06 §6.2：被助力方每日上限 5 次。 */
const TARGET_DAILY_LIMIT = 5;

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
  const logs = cloud.database().collection<AssistLogRow>('assist_logs');

  const existing = await logs.where({ helperId, targetId, date }).limit(1).get();
  let dailyCount = (await logs.where({ targetId, date }).count()).total;
  if (existing.data.length > 0) {
    return ok<AssistData>(result(false, 'ALREADY_ASSISTED', dailyCount));
  }
  if (dailyCount >= TARGET_DAILY_LIMIT) {
    return ok<AssistData>(result(false, 'LIMIT', dailyCount));
  }

  try {
    await logs.add({
      data: { helperId, targetId, date, resourceType, nonce, createdAt: Date.now(), status: 'active' },
    });
  } catch (error: unknown) {
    // 唯一索引冲突即视为已助力；其他写失败抛回平台，客户端进入补发队列。
    const retry = await logs.where({ helperId, targetId, date }).limit(1).get();
    if (retry.data.length > 0) {
      return ok<AssistData>(result(false, 'ALREADY_ASSISTED', dailyCount));
    }
    throw error;
  }

  dailyCount += 1;
  return ok<AssistData>(result(true, null, dailyCount));
}
