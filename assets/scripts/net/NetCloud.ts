// STATUS: implemented, W5 云函数 callFunction（超时包装）

export function invokeCloud(
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
    wx.cloud
      .callFunction({ name, data })
      .then((result) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(result);
        }
      })
      .catch((error: unknown) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(error instanceof Error ? error : new Error('NETWORK_ERROR'));
        }
      });
  });
}
