// STATUS: implemented, W7 真实激励视频（按场景缓存实例 + show 失败先 load 再 show + isEnded 校验）
// API: Ad.showRewarded, see docs/plan/11-IAA广告系统.md
import { adUnitId, isAdConfigured } from '../config/AdConfig';

export type AdCode = 'OK' | 'AD_NOT_READY' | 'AD_NOT_ENDED' | 'AD_ERROR' | 'AD_UNAVAILABLE';

export interface AdResult {
  ok: boolean;
  code: AdCode;
  scene: string;
  isEnded: boolean;
  /** 广告不可用但按一次奖励降级发放；调用方照常发奖即可。 */
  degraded?: boolean;
}

/** onClose 长时间不回调时的兜底，避免等待页卡死。 */
const WATCH_TIMEOUT_MS = 120000;

function platformReady(): boolean {
  return typeof wx !== 'undefined' && typeof wx.createRewardedVideoAd === 'function';
}

export class AdClient {
  private readonly ads = new Map<string, WxRewardedVideoAd>();

  async showRewarded(scene: string): Promise<AdResult> {
    if (!scene) {
      return fail('AD_ERROR', scene);
    }
    if (!platformReady() || !isAdConfigured(scene)) {
      return fail('AD_UNAVAILABLE', scene);
    }
    const ad = this.instance(scene);
    return ad ? this.play(ad, scene) : fail('AD_UNAVAILABLE', scene);
  }

  /** 同一广告位只创建一个实例；重复创建会触发微信侧报错。 */
  private instance(scene: string): WxRewardedVideoAd | null {
    const cached = this.ads.get(scene);
    if (cached) {
      return cached;
    }
    try {
      const created = wx.createRewardedVideoAd?.({ adUnitId: adUnitId(scene) });
      if (!created) {
        return null;
      }
      this.ads.set(scene, created);
      return created;
    } catch {
      return null;
    }
  }

  private play(ad: WxRewardedVideoAd, scene: string): Promise<AdResult> {
    return new Promise<AdResult>((resolve) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const finish = (result: AdResult): void => {
        if (settled) {
          return;
        }
        settled = true;
        if (timer !== null) {
          clearTimeout(timer);
        }
        ad.offClose(onClose);
        ad.offError(onError);
        resolve(result);
      };
      const onClose = (res?: WxRewardedVideoAdCloseResult): void => {
        const ended = res?.isEnded === true;
        finish({ ok: ended, code: ended ? 'OK' : 'AD_NOT_ENDED', scene, isEnded: ended });
      };
      const onError = (): void => finish(fail('AD_ERROR', scene));
      ad.onClose(onClose);
      ad.onError(onError);
      timer = setTimeout(() => finish(fail('AD_ERROR', scene)), WATCH_TIMEOUT_MS);
      ad.show().catch(() => {
        ad.load()
          .then(() => ad.show())
          .catch(() => finish(fail('AD_UNAVAILABLE', scene)));
      });
    });
  }
}

function fail(code: AdCode, scene: string): AdResult {
  return { ok: false, code, scene, isEnded: false };
}

export const Ad = new AdClient();
