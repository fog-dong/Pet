// STATUS: scaffold, W20-2/任务四 小屋离线收益领取骨架（服务端计时 + 事务幂等；云函数未部署前客户端不调用，本地绝不铸币）
// API: claimHabitat, see docs/plan/接口冻结清单.md §2.12
import * as cloud from 'wx-server-sdk';
import { claimHabitatSettle } from './settle';
import type { ClaimOutcome } from './settle';

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database({ throwOnNotFound: false });

/** 领养只数的计价上限：`pets` 集合即使被改大，单次铸币量也被这个常数夹住。 */
const MAX_PET_COUNT = 20;
/** 允许的最大时钟漂移：客户端时间比服务端还新就直接拒（幂等靠服务端计时，不靠这个字段）。 */
const CLOCK_SLACK_MS = 5 * 60 * 1000;
/** 事务冲突重试耗尽：可安全重试，客户端下一次进小屋再领。 */
const RETRY_EXHAUSTED_CODE = 1006;
const RATE_LIMITED_CODE = 1003;

interface CloudResponse<T> {
  code: number;
  msg: string;
  data: T | null;
  serverTime?: number;
}

interface ClaimHabitatEvent {
  lastClaimTime?: unknown;
}

interface ClaimHabitatData {
  hours: number;
  coins: number;
}

function ok<T>(data: T): CloudResponse<T> {
  return { code: 0, msg: 'ok', data, serverTime: Date.now() };
}

function fail<T>(code: number, msg: string): CloudResponse<T> {
  return { code, msg, data: null, serverTime: Date.now() };
}

/** 拒绝路径统一留一行结构化日志：上线后能直接从日志区分 1003（当日额度用满）与其他失败。 */
function reject<T>(code: number, msg: string, openid: string): CloudResponse<T> {
  console.warn('[claimHabitat] reject code=%d msg=%s openid=%s', code, msg, openid);
  return fail<T>(code, msg);
}

/**
 * SDK 只对事务冲突自动重试（默认 3 次），耗尽后抛出的仍是冲突类错误。
 * 其余异常（权限、网络）不上报 1006，原样上抛交给平台日志与客户端重试。
 */
function isTransactionConflict(error: unknown): boolean {
  const source = error as { errCode?: unknown; code?: unknown; message?: unknown };
  const markers = [source.errCode, source.code, source.message]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toUpperCase();
  return markers.includes('CONFLICT') || markers.includes('TRANSACTION');
}

/** 以北京时间（UTC+8）切日，与 adEvent / assist 的计数口径保持一致。 */
function shanghaiDate(now: number): string {
  return new Date(now + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * 计价只取服务端能自证的事实：`pets` 里归属当前用户、状态为 adopted 的只数。
 * 小屋三项属性仍在本地存档（偏差 D19），所以心情系数暂按 1.0，等属性上云再分档。
 */
async function adoptedCount(openid: string): Promise<number> {
  const result = await db
    .collection('pets')
    .where({ status: 'adopted', adoptedBy: openid })
    .limit(MAX_PET_COUNT)
    .count();
  const total = result && typeof result.total === 'number' ? result.total : 0;
  return Math.min(Math.max(total, 0), MAX_PET_COUNT);
}

function toData(outcome: ClaimOutcome): ClaimHabitatData {
  return { hours: outcome.hours, coins: outcome.coins };
}

export async function main(event: ClaimHabitatEvent): Promise<CloudResponse<ClaimHabitatData>> {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return reject<ClaimHabitatData>(1001, 'SESSION_INVALID', '-');
  }

  const now = Date.now();
  const lastClaimTime = event.lastClaimTime;
  if (typeof lastClaimTime !== 'number' || !Number.isInteger(lastClaimTime) || lastClaimTime < 0) {
    return reject<ClaimHabitatData>(1002, 'INVALID_PARAM', OPENID);
  }
  if (lastClaimTime > now + CLOCK_SLACK_MS) {
    return reject<ClaimHabitatData>(1002, 'INVALID_PARAM', OPENID);
  }

  let outcome: ClaimOutcome;
  try {
    outcome = await claimHabitatSettle({
      openid: OPENID,
      clientLastClaimAt: lastClaimTime,
      adoptedCount: await adoptedCount(OPENID),
      now,
      platformDate: shanghaiDate(now),
    });
  } catch (error) {
    if (isTransactionConflict(error)) {
      return reject<ClaimHabitatData>(RETRY_EXHAUSTED_CODE, 'TRANSACTION_RETRY_EXHAUSTED', OPENID);
    }
    throw error;
  }

  if (outcome.status === 'no-user') {
    return reject<ClaimHabitatData>(1001, 'SESSION_INVALID', OPENID);
  }
  if (outcome.status === 'limited') {
    return reject<ClaimHabitatData>(RATE_LIMITED_CODE, 'RATE_LIMITED', OPENID);
  }
  return ok<ClaimHabitatData>(toData(outcome));
}
