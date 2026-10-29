// STATUS: scaffold, API frozen by architect on 2026-10-29
// API: createOrder, see docs/plan/接口冻结清单.md §2.8
import * as cloud from 'wx-server-sdk';

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

interface CloudResponse<T> {
  code: number;
  msg: string;
  data: T | null;
  serverTime?: number;
}

interface CreateOrderEvent {
  skuId?: unknown;
  clientOrderId?: unknown;
}

interface CreateOrderData {
  orderId: string;
  payParams: Record<string, unknown>;
  status: 'CREATED';
}

function fail<T>(code: number, msg: string): CloudResponse<T> {
  return { code, msg, data: null, serverTime: Date.now() };
}

export async function main(
  event: CreateOrderEvent,
): Promise<CloudResponse<CreateOrderData>> {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return fail<CreateOrderData>(1001, 'SESSION_INVALID');
  }

  const skuId = event.skuId;
  const clientOrderId = event.clientOrderId;
  if (typeof skuId !== 'string' || skuId.length === 0) {
    return fail<CreateOrderData>(1002, 'INVALID_PARAM');
  }
  if (typeof clientOrderId !== 'string' || clientOrderId.length === 0) {
    return fail<CreateOrderData>(1002, 'INVALID_PARAM');
  }

  // F1 冻结：W1-W4 不创建真实订单、不调用统一下单、不返回支付参数。
  return fail<CreateOrderData>(3002, 'PAY_UNAVAILABLE');
}
