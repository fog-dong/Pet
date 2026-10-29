// STATUS: scaffold, API frozen by architect on 2026-10-29
// API: Pay.createOrder, see docs/plan/接口冻结清单.md §2.8

export type PayCode = 'OK' | 'PAY_UNAVAILABLE' | 'PAY_ERROR';

export interface PayOrderData {
  orderId: string;
  status: 'CREATED' | 'PAYING' | 'PAID' | 'DELIVERED';
}

export interface PayResult {
  code: PayCode;
  msg: string;
  data: PayOrderData | null;
}

export class PayClient {
  /**
   * F1 冻结：W1-W4 固定返回 PAY_UNAVAILABLE。
   * 禁止在此调用 wx.requestMidasPayment 或任何真实虚拟支付接口。
   */
  async createOrder(sku: string): Promise<PayResult> {
    if (!sku) {
      return { code: 'PAY_ERROR', msg: 'EMPTY_SKU', data: null };
    }
    return { code: 'PAY_UNAVAILABLE', msg: 'PAY_UNAVAILABLE', data: null };
  }
}

export const Pay = new PayClient();
