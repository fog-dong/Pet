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

interface WxShareOptions {
  title: string;
  imageUrl?: string;
  query?: string;
}

interface WxRewardedVideoAdCloseResult {
  isEnded?: boolean;
}

interface WxRewardedVideoAdError {
  errCode?: number;
  errMsg?: string;
}

/** 激励视频广告实例（基础库 2.0.4+；show/load 在 2.8.0+ 返回 Promise）。 */
interface WxRewardedVideoAd {
  load(): Promise<void>;
  show(): Promise<void>;
  onClose(callback: (result?: WxRewardedVideoAdCloseResult) => void): void;
  offClose(callback: (result?: WxRewardedVideoAdCloseResult) => void): void;
  onError(callback: (error: WxRewardedVideoAdError) => void): void;
  offError(callback: (error: WxRewardedVideoAdError) => void): void;
  destroy?(): void;
}

interface WxPrivacyResolveResult {
  event: 'agree' | 'disagree';
}

/** 平台隐私授权回调：resolve 决定本次敏感接口调用是否放行。 */
type WxPrivacyResolve = (result: WxPrivacyResolveResult) => void;

interface WxPrivacyApiOptions {
  success?: () => void;
  fail?: (error: unknown) => void;
}

/** 微信客服会话参数（小游戏 openCustomerServiceChat，基础库 2.22.1+）；url 来自公众平台客服配置。 */
interface WxCustomerServiceOptions {
  extInfo: { url: string };
  scene?: string;
  success?: () => void;
  fail?: (error: unknown) => void;
}

interface WxApi {
  cloud: WxCloudApi;
  shareAppMessage(options: WxShareOptions): void;
  createRewardedVideoAd?(options: { adUnitId: string }): WxRewardedVideoAd;
  requirePrivacyAuthorize?(options: WxPrivacyApiOptions): void;
  onNeedPrivacyAuthorization?(callback: (resolve: WxPrivacyResolve, eventInfo?: unknown) => void): void;
  openPrivacyContract?(options: WxPrivacyApiOptions): void;
  openCustomerServiceChat?(options: WxCustomerServiceOptions): void;
}

declare const wx: WxApi;
