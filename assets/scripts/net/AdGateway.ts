// STATUS: implemented, W3 广告发放出口（频控 + ad_reward 埋点，业务层唯一调用点）
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
  }
  return result;
}
