// STATUS: scaffold, API frozen by architect on 2026-10-29
// API: adEvent, see docs/plan/接口冻结清单.md §2.7
import * as cloud from 'wx-server-sdk';

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

interface CloudResponse<T> {
  code: number;
  msg: string;
  data: T | null;
  serverTime?: number;
}

interface AdEventPayload {
  adSessionId?: unknown;
  adUnitId?: unknown;
  scene?: unknown;
  isEnded?: unknown;
}

interface AdEventData {
  granted: boolean;
  reward: null;
  todayCount: number;
}

function ok<T>(data: T): CloudResponse<T> {
  return { code: 0, msg: 'ok', data, serverTime: Date.now() };
}

function fail<T>(code: number, msg: string): CloudResponse<T> {
  return { code, msg, data: null, serverTime: Date.now() };
}

export async function main(event: AdEventPayload): Promise<CloudResponse<AdEventData>> {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return fail<AdEventData>(1001, 'SESSION_INVALID');
  }

  const adSessionId = event.adSessionId;
  const adUnitId = event.adUnitId;
  const scene = event.scene;
  if (typeof adSessionId !== 'string' || adSessionId.length === 0) {
    return fail<AdEventData>(1002, 'INVALID_PARAM');
  }
  if (typeof adUnitId !== 'string' || adUnitId.length === 0) {
    return fail<AdEventData>(1002, 'INVALID_PARAM');
  }
  if (typeof scene !== 'string' || scene.length === 0) {
    return fail<AdEventData>(1002, 'INVALID_PARAM');
  }
  if (typeof event.isEnded !== 'boolean') {
    return fail<AdEventData>(1002, 'INVALID_PARAM');
  }

  if (!event.isEnded) {
    return ok<AdEventData>({ granted: false, reward: null, todayCount: 0 });
  }

  // W2: 校验 idempotencyKey（openid:adSessionId）唯一索引与广告位白名单；
  // 按每日上限发奖，返回最新计数。W1 不接真实广告，不写库、不发奖。
  return ok<AdEventData>({ granted: false, reward: null, todayCount: 0 });
}
