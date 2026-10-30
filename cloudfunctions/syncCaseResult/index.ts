// STATUS: implemented, W12-3 服务端结算（配置驱动重算 + 事务幂等发奖）
// API: syncCaseResult, see docs/plan/接口冻结清单.md §2.4
import * as cloud from 'wx-server-sdk';
import { readCaseCatalog } from './cases';
import { isInt } from './guard';
import { settleCaseResult } from './settle';
import { clearPending, markPending } from './pending';
import type { CaseConfigItem, CaseRewards, CaseResultSummary } from './types';
import { readDiagnosis, readTreatment } from './validate';

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

interface CloudResponse<T> {
  code: number;
  msg: string;
  data: T | null;
  serverTime?: number;
}

interface SyncCaseResultEvent {
  caseSessionId?: unknown;
  caseId?: unknown;
  diagnosis?: unknown;
  treatment?: unknown;
  durationMs?: unknown;
}

interface SyncCaseResultData {
  result: CaseResultSummary;
  rewards: CaseRewards;
  resources: Record<string, unknown>;
}

interface ConfigDoc {
  configKey?: string;
  version?: number;
  payload?: unknown;
}

const MAX_ID_LENGTH = 64;
const MAX_DURATION_MS = 24 * 3600 * 1000;
const MAX_CONFIG_DOCS = 100;
/** 事务冲突重试耗尽：可安全重试，客户端按补发队列下次再发。 */
const RETRY_EXHAUSTED_CODE = 1006;
const INVALID_STATE_CODE = 2002;

function ok<T>(data: T): CloudResponse<T> {
  return { code: 0, msg: 'ok', data, serverTime: Date.now() };
}

function fail<T>(code: number, msg: string): CloudResponse<T> {
  return { code, msg, data: null, serverTime: Date.now() };
}

/** 拒绝路径统一留一行结构化日志：上线后能直接从日志区分 2002（配置未发布）与其他失败。 */
function reject<T>(code: number, msg: string, caseId: string): CloudResponse<T> {
  console.warn('[syncCaseResult] reject code=%d msg=%s caseId=%s', code, msg, caseId);
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

/** 与 getConfig 同口径：`config` 集合取 `configKey='cases'` 的最高 active 版本。 */
async function loadCaseCatalog(): Promise<Map<string, CaseConfigItem> | null> {
  const result = await cloud
    .database()
    .collection<ConfigDoc>('config')
    .where({ status: 'active' })
    .limit(MAX_CONFIG_DOCS)
    .get();
  let latest: ConfigDoc | null = null;
  for (const doc of result.data) {
    if (doc.configKey !== 'cases') {
      continue;
    }
    if (!latest || (doc.version ?? -1) > (latest.version ?? -1)) {
      latest = doc;
    }
  }
  return latest ? readCaseCatalog(latest.payload) : null;
}

export async function main(event: SyncCaseResultEvent): Promise<CloudResponse<SyncCaseResultData>> {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return reject<SyncCaseResultData>(1001, 'SESSION_INVALID', '-');
  }

  const { caseSessionId, caseId, durationMs } = event;
  if (typeof caseSessionId !== 'string' || caseSessionId.length === 0 || caseSessionId.length > MAX_ID_LENGTH) {
    return reject<SyncCaseResultData>(1002, 'INVALID_PARAM', '-');
  }
  if (typeof caseId !== 'string' || caseId.length === 0 || caseId.length > MAX_ID_LENGTH) {
    return reject<SyncCaseResultData>(1002, 'INVALID_PARAM', '-');
  }
  const diagnosis = readDiagnosis(event.diagnosis);
  const treatment = readTreatment(event.treatment);
  if (!diagnosis || !treatment || !isInt(durationMs, 0, MAX_DURATION_MS)) {
    return reject<SyncCaseResultData>(1002, 'INVALID_PARAM', caseId);
  }

  const item = (await loadCaseCatalog())?.get(caseId);
  if (!item) {
    // 配置未发布或病例不存在：不按客户端数值兜底发奖；记一条服务端标记供每日积压扫描。
    await markPending(OPENID, caseSessionId, caseId, INVALID_STATE_CODE, Date.now());
    return reject<SyncCaseResultData>(INVALID_STATE_CODE, 'INVALID_STATE', caseId);
  }

  try {
    const outcome = await settleCaseResult({
      openid: OPENID,
      caseSessionId,
      caseId,
      diagnosis,
      treatment,
      durationMs,
      item,
      now: Date.now(),
    });
    if (!outcome) {
      return reject<SyncCaseResultData>(1001, 'SESSION_INVALID', caseId);
    }
    await clearPending(OPENID, caseSessionId);
    return ok<SyncCaseResultData>({
      result: outcome.result,
      rewards: outcome.rewards,
      resources: outcome.resources,
    });
  } catch (error) {
    if (isTransactionConflict(error)) {
      return reject<SyncCaseResultData>(RETRY_EXHAUSTED_CODE, 'TRANSACTION_RETRY_EXHAUSTED', caseId);
    }
    throw error;
  }
}
