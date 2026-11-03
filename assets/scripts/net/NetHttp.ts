// STATUS: implemented, W21 Axum HTTP 调用（超时 + Authorization）
import { Session } from './Session';

export function invokeHttp(
  apiBase: string,
  name: string,
  data: Record<string, unknown>,
  timeoutMs: number,
): Promise<WxCloudCallResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('NET_TIMEOUT'));
      }
    }, timeoutMs);

    const header: Record<string, string> = { 'content-type': 'application/json' };
    if (Session.hasToken && name !== 'login') {
      header.Authorization = `Bearer ${Session.token}`;
    }

    wx.request({
      url: `${apiBase}/api/${name}`,
      method: 'POST',
      data,
      header,
      success: (res) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve({ result: res.data });
      },
      fail: () => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        reject(new Error('NETWORK_ERROR'));
      },
    });
  });
}
