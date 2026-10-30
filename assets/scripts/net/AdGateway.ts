// STATUS: implemented, W7 广告发放出口（频控 + 配置校验 + 降级开关 + 埋点，业务层唯一调用点）
import { Ad, AdResult } from './Ad';
import { reportAdEvent } from './AdEvent';
import { AdQuota } from '../cache/AdQuota';
import { AD_DEGRADE_ENABLED, isAdConfigured } from '../config/AdConfig';
import { Track } from '../track/Track';

const REWARD_LABEL: Readonly<Record<string, string>> = {
  extra_check: 'clue',
  accelerate: 'speed',
  double_reward: 'coins',
  extra_inspection: 'hint',
  free_slot: 'slot',
  extra_medicine: 'medicine',
  extra_bed: 'bed',
};

/** 广告位已配置且当日次数未用尽，才允许把按钮显示为可点。 */
export function canOfferAd(scene: string): boolean {
  return isAdConfigured(scene) && AdQuota.canShow(scene);
}

/** 广告未成功的统一文案：区分额度用尽 / 未看完 / 不可用，避免把占位配置说成“次数用完”。 */
export function adFailHint(result: AdResult, exhausted: string): string {
  if (result.code === 'AD_NOT_READY') {
    return exhausted;
  }
  if (result.code === 'AD_NOT_ENDED') {
    return '完整看完广告才能领取奖励';
  }
  return '广告暂不可用，可以先走免费路径';
}

/** 展示激励视频并核销次数；超过每日上限时不打扰玩家，直接返回未就绪。 */
export async function showAd(scene: string): Promise<AdResult> {
  if (!AdQuota.canShow(scene)) {
    // 未起播，没有广告会话，因此不带 adSessionId。
    return { ok: false, code: 'AD_NOT_READY', scene, isEnded: false, adSessionId: '' };
  }
  const result = await Ad.showRewarded(scene);
  if (result.ok) {
    AdQuota.consume(scene);
    void reportAdEvent(scene, result.adSessionId, true);
    Track.track('ad_reward', { scene, reward: REWARD_LABEL[scene] ?? scene });
    return result;
  }
  if (result.code === 'AD_NOT_ENDED') {
    void reportAdEvent(scene, result.adSessionId, false);
    return result;
  }
  if (!isAdConfigured(scene)) {
    // 占位广告位绝不发奖，防止提审前出现“没看广告也拿到奖励”。
    Track.track('ad_unconfigured', { scene });
    return result;
  }
  if (!AD_DEGRADE_ENABLED) {
    Track.track('ad_load_fail', { scene, code: result.code });
    return result;
  }
  // 广告不可用不阻塞玩法：按一次奖励降级发放，并照常消耗当日次数，避免断网刷奖励。
  AdQuota.consume(scene);
  Track.track('ad_load_fail', { scene, code: result.code });
  Track.track('ad_reward', { scene, reward: REWARD_LABEL[scene] ?? scene, degraded: true });
  return { ...result, ok: true, degraded: true };
}
