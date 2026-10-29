// STATUS: scaffold, API frozen by architect on 2026-10-29
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
  targetId?: unknown;
  resourceType?: unknown;
  nonce?: unknown;
}

interface AssistData {
  granted: boolean;
  resources: null;
  reason: 'ALREADY_ASSISTED' | 'LIMIT' | 'EXPIRED' | null;
}

const RESOURCE_TYPES: readonly string[] = ['medicine', 'bed', 'heart'];

function ok<T>(data: T): CloudResponse<T> {
  return { code: 0, msg: 'ok', data, serverTime: Date.now() };
}

function fail<T>(code: number, msg: string): CloudResponse<T> {
  return { code, msg, data: null, serverTime: Date.now() };
}

export async function main(event: AssistEvent): Promise<CloudResponse<AssistData>> {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return fail<AssistData>(1001, 'SESSION_INVALID');
  }

  const targetId = event.targetId;
  if (typeof targetId !== 'string' || targetId.length === 0 || targetId === OPENID) {
    return fail<AssistData>(1002, 'INVALID_PARAM');
  }

  const resourceType = event.resourceType;
  if (typeof resourceType !== 'string' || !RESOURCE_TYPES.includes(resourceType)) {
    return fail<AssistData>(1002, 'INVALID_PARAM');
  }

  const nonce = event.nonce;
  if (typeof nonce !== 'string' || nonce.length === 0) {
    return fail<AssistData>(1002, 'INVALID_PARAM');
  }

  // W2: 校验收求助单签名与过期时间；按 helperId + targetId + date 唯一索引幂等；
  // 校验 helper 3 次/日、target 5 次/日；事务写 assist_logs 并发资源。
  return ok<AssistData>({ granted: false, resources: null, reason: null });
}
