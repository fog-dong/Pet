// STATUS: implemented, W8-5 平台隐私授权出口（业务层唯一允许触达 wx 隐私 API 的模块）
// API: WxPrivacy.register / request / openContract, see docs/plan/15-性能优化发布与合规检查.md §6
import { PrivacyState } from '../cache/PrivacyState';

export type PrivacyRequestResult = 'granted' | 'denied' | 'unsupported';

/** 平台回调可能因用户停留在系统弹窗而不返回；超时后放行进厅，本地同意状态已经落盘。 */
const REQUEST_TIMEOUT_MS = 8000;

function platform(): WxApi | null {
  return typeof wx === 'undefined' ? null : wx;
}

export class PrivacyClient {
  private registered = false;

  /**
   * 只装一次：平台触发隐私请求时按本地同意状态直接答复，
   * 避免官方弹窗与本工程弹窗重复出现。
   */
  register(): void {
    const api = platform();
    if (this.registered || !api || typeof api.onNeedPrivacyAuthorization !== 'function') {
      return;
    }
    this.registered = true;
    api.onNeedPrivacyAuthorization((resolve) => {
      resolve({ event: PrivacyState.accepted() ? 'agree' : 'disagree' });
    });
  }

  /** 用户在自研弹窗点「同意」后同步平台授权态；不支持或超时都不阻塞玩法。 */
  request(): Promise<PrivacyRequestResult> {
    const api = platform();
    if (!api || typeof api.requirePrivacyAuthorize !== 'function') {
      return Promise.resolve('unsupported');
    }
    return new Promise<PrivacyRequestResult>((resolve) => {
      let settled = false;
      const settle = (result: PrivacyRequestResult): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve(result);
      };
      const timer = setTimeout(() => settle('unsupported'), REQUEST_TIMEOUT_MS);
      api.requirePrivacyAuthorize?.({
        success: () => settle('granted'),
        fail: () => settle('denied'),
      });
    });
  }

  /** 优先看平台侧正式《隐私保护指引》；返回 false 表示要回退到内置文本。 */
  openContract(): boolean {
    const api = platform();
    if (!api || typeof api.openPrivacyContract !== 'function') {
      return false;
    }
    try {
      api.openPrivacyContract?.({});
      return true;
    } catch {
      return false;
    }
  }
}

export const WxPrivacy = new PrivacyClient();
