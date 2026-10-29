// STATUS: scaffold, API frozen by architect on 2026-10-29
// API: payCallback, see docs/plan/接口冻结清单.md §2.9
import * as cloud from 'wx-server-sdk';

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

interface CloudResponse<T> {
  code: number;
  msg: string;
  data: T | null;
  serverTime?: number;
}

interface PayCallbackEvent {
  platformPayload?: unknown;
}

function fail<T>(code: number, msg: string): CloudResponse<T> {
  return { code, msg, data: null, serverTime: Date.now() };
}

export async function main(
  event: PayCallbackEvent,
): Promise<CloudResponse<null>> {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return fail<null>(1001, 'SESSION_INVALID');
  }

  const payload = event.platformPayload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return fail<null>(1002, 'INVALID_PARAM');
  }

  // F1 冻结：W1-W4 不验真实平台报文、不发货、不更新订单。
  return fail<null>(3002, 'PAY_UNAVAILABLE');
}
