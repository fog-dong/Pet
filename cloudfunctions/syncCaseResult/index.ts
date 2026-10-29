// STATUS: scaffold, API frozen by architect on 2026-10-29
// API: syncCaseResult, see docs/plan/接口冻结清单.md §2.4
import * as cloud from 'wx-server-sdk';

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
  result: null;
  rewards: null;
  resources: null;
}

function ok<T>(data: T): CloudResponse<T> {
  return { code: 0, msg: 'ok', data, serverTime: Date.now() };
}

function fail<T>(code: number, msg: string): CloudResponse<T> {
  return { code, msg, data: null, serverTime: Date.now() };
}

export async function main(
  event: SyncCaseResultEvent,
): Promise<CloudResponse<SyncCaseResultData>> {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return fail<SyncCaseResultData>(1001, 'SESSION_INVALID');
  }

  const caseSessionId = event.caseSessionId;
  const caseId = event.caseId;
  if (typeof caseSessionId !== 'string' || caseSessionId.length === 0) {
    return fail<SyncCaseResultData>(1002, 'INVALID_PARAM');
  }
  if (typeof caseId !== 'string' || caseId.length === 0) {
    return fail<SyncCaseResultData>(1002, 'INVALID_PARAM');
  }

  const diagnosis = event.diagnosis;
  const treatment = event.treatment;
  if (!diagnosis || typeof diagnosis !== 'object' || Array.isArray(diagnosis)) {
    return fail<SyncCaseResultData>(1002, 'INVALID_PARAM');
  }
  if (!treatment || typeof treatment !== 'object' || Array.isArray(treatment)) {
    return fail<SyncCaseResultData>(1002, 'INVALID_PARAM');
  }

  const durationMs = event.durationMs;
  if (typeof durationMs !== 'number' || durationMs < 0) {
    return fail<SyncCaseResultData>(1002, 'INVALID_PARAM');
  }

  // W2 幂等占位：按 pets_cases.caseSessionId 唯一索引先查历史；已存在直接返回历史结果，
  // 不重复计算奖励。W1 不做结算、不写库，返回空结构。
  return ok<SyncCaseResultData>({ result: null, rewards: null, resources: null });
}
