// STATUS: scaffold, API frozen by architect on 2026-10-29
// API: Ad.showRewarded, see docs/plan/11-IAA广告系统.md

export type AdCode = 'OK' | 'AD_NOT_READY' | 'AD_NOT_ENDED' | 'AD_ERROR';

export interface AdResult {
  ok: boolean;
  code: AdCode;
  scene: string;
  isEnded: boolean;
}

export class AdClient {
  /**
   * W1 占位：不创建真实激励视频实例，不硬编码广告位 ID。
   * W2 接入时在内部包装 wx.createRewardedVideoAd，业务层不得直接调用。
   */
  async showRewarded(scene: string): Promise<AdResult> {
    if (!scene) {
      return { ok: false, code: 'AD_ERROR', scene, isEnded: false };
    }
    return { ok: false, code: 'AD_NOT_READY', scene, isEnded: false };
  }
}

export const Ad = new AdClient();
