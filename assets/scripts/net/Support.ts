// STATUS: implemented, W9-5 微信客服会话出口（业务层唯一允许触达 openCustomerServiceChat 的模块）
// API: openCustomerService, see docs/plan/15-性能优化发布与合规检查.md §6「客服」
import { CUSTOMER_SERVICE, customerServiceReady } from '../config/LegalConfig';

export type SupportResult = 'opened' | 'unconfigured' | 'unsupported' | 'failed';

/** 客服面板可能停在平台侧不回调，超时后按未响应处理，UI 仍能给出兜底文案。 */
const SUPPORT_TIMEOUT_MS = 8000;

function platform(): WxApi | null {
  return typeof wx === 'undefined' ? null : wx;
}

/** 打开微信客服会话；未配置、不支持、失败都只返回结果，不抛错也不静默。 */
export function openCustomerService(): Promise<SupportResult> {
  if (!customerServiceReady()) {
    return Promise.resolve('unconfigured');
  }
  const api = platform();
  if (!api || typeof api.openCustomerServiceChat !== 'function') {
    return Promise.resolve('unsupported');
  }
  return new Promise<SupportResult>((resolve) => {
    let settled = false;
    const settle = (result: SupportResult): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => settle('unsupported'), SUPPORT_TIMEOUT_MS);
    try {
      api.openCustomerServiceChat?.({
        extInfo: { url: CUSTOMER_SERVICE.url },
        scene: CUSTOMER_SERVICE.scene,
        success: (): void => settle('opened'),
        fail: (): void => settle('failed'),
      });
    } catch {
      settle('failed');
    }
  });
}

/** 兜底文案：只有确定打开成功才不提示，其余情况都给玩家一个去处。 */
export function supportFallback(result: SupportResult): string {
  return result === 'opened' ? '' : CUSTOMER_SERVICE.fallbackText;
}
