// STATUS: implemented, W3 IAA 占位（本地 mock：1 秒后 isEnded=true，不调用 wx.createRewardedVideoAd）
// API: Ad.showRewarded, see docs/plan/11-IAA广告系统.md

export type AdCode = 'OK' | 'AD_NOT_READY' | 'AD_NOT_ENDED' | 'AD_ERROR';

export interface AdResult {
  ok: boolean;
  code: AdCode;
  scene: string;
  isEnded: boolean;
}

/** 本地 mock：模拟用户看完 1 秒激励视频，不创建真实广告实例。 */
const MOCK_MS = 1000;

export class AdClient {
  /**
   * W3 占位：真机联调时在内部替换为 wx.createRewardedVideoAd，
   * 业务层只允许通过 net/AdGateway 调用，不直接持有平台对象。
   */
  async showRewarded(scene: string): Promise<AdResult> {
    if (!scene) {
      return { ok: false, code: 'AD_ERROR', scene, isEnded: false };
    }
    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), MOCK_MS);
    });
    return { ok: true, code: 'OK', scene, isEnded: true };
  }
}

export const Ad = new AdClient();
