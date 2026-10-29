// STATUS: scaffold, API frozen by architect on 2026-10-29
// 平台无类型 API 的最小声明；只有 net/ 下的模块允许使用 wx。

interface WxCloudCallResult {
  result?: unknown;
}

interface WxCloudApi {
  init(options: { env: string; traceUser?: boolean }): void;
  callFunction(options: {
    name: string;
    data?: Record<string, unknown>;
  }): Promise<WxCloudCallResult>;
}

interface WxApi {
  cloud: WxCloudApi;
}

declare const wx: WxApi;
