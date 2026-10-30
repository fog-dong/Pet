// STATUS: implemented, W11-1 好友助力（事务内去重 + 计数 + 超限判定，不再使用 inc + 回退）
// API: assist, see docs/plan/接口冻结清单.md §2.6
import * as cloud from 'wx-server-sdk';
import { settleAssist } from './settle';
import type { AssistReason } from './settle';

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

interface AssistData {
  granted: boolean;
  assisted: boolean;
  reason: AssistReason | null;
  dailyCount: number;
  resources: null;
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

  const now = Date.now();
  const targetId = OPENID;
  const date = shanghaiDate(now);
  // 去重、额度判定、计数与 pair 落库都在 settleAssist 的事务里一次完成，这里只负责校验与结果映射。
  const outcome = await settleAssist({
    pairId: `${targetId}_${helperId}_${date}`,
    dailyId: `${targetId}_${date}`,
    targetId,
    helperId,
    date,
    resourceType,
    nonce,
    limit: TARGET_DAILY_LIMIT,
    now,
  });

  if (outcome.reason === 'LIMIT') {
    return fail<AssistData>(ASSIST_LIMIT_CODE, 'TODAY_ASSIST_LIMIT');
  }
  return ok<AssistData>({
    granted: outcome.granted,
    assisted: outcome.granted,
    reason: outcome.reason,
    dailyCount: outcome.dailyCount,
    resources: null,
  });
}
