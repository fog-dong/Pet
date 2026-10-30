// STATUS: implemented, W7 广告发放出口（频控 + 加载失败降级 + 埋点，业务层唯一调用点）
import { Ad, AdResult } from './Ad';
import { AdQuota } from '../cache/AdQuota';
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

/** 展示激励视频并核销次数；超过每日上限时不打扰玩家，直接返回未就绪。 */
export async function showAd(scene: string): Promise<AdResult> {
  if (!AdQuota.canShow(scene)) {
    return { ok: false, code: 'AD_NOT_READY', scene, isEnded: false };
  }
  const result = await Ad.showRewarded(scene);
  if (result.ok) {
    AdQuota.consume(scene);
    Track.track('ad_reward', { scene, reward: REWARD_LABEL[scene] ?? scene });
    return result;
  }
  if (result.code === 'AD_NOT_ENDED') {
    return result;
  }
  // 广告不可用不阻塞玩法：按一次奖励降级发放，并照常消耗当日次数，避免断网刷奖励。
  AdQuota.consume(scene);
  Track.track('ad_load_fail', { scene, code: result.code });
  Track.track('ad_reward', { scene, reward: REWARD_LABEL[scene] ?? scene, degraded: true });
  return { ...result, ok: true, degraded: true };
}
