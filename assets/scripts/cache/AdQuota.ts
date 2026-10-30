// STATUS: implemented, W3 激励视频频控（本地存档，按自然日重置）
import { Save } from './Save';
import { todayKey } from './DayKey';
import { isAdConfigured } from '../config/AdConfig';

/** 每日上限：双倍奖励 5 次、免费领养位 3 次（11 文档），其余按点位给保守上限。 */
export const AD_DAILY_LIMIT: Readonly<Record<string, number>> = {
  extra_check: 3,
  accelerate: 5,
  double_reward: 5,
  extra_inspection: 3,
  free_slot: 3,
  extra_medicine: 5,
  extra_bed: 3,
};

function today(): string {
  return todayKey();
}

export class AdQuotaStore {
  remaining(scene: string): number {
    const limit = AD_DAILY_LIMIT[scene];
    if (limit === undefined) {
      return 0;
    }
    const data = Save.snapshot();
    if (data.adDay !== today()) {
      return limit;
    }
    return Math.max(0, limit - (data.adCounts[scene] ?? 0));
  }

  canShow(scene: string): boolean {
    return this.remaining(scene) > 0;
  }

  consume(scene: string): void {
    const day = today();
    Save.mutate((data) => {
      if (data.adDay !== day) {
        data.adDay = day;
        data.adCounts = {};
      }
      data.adCounts[scene] = (data.adCounts[scene] ?? 0) + 1;
    });
  }
}

export const AdQuota = new AdQuotaStore();

/** 按钮文案：可用时显示剩余次数，未配置/超限时明确提示原因。 */
export function adButtonText(scene: string, base: string): string {
  if (!isAdConfigured(scene)) {
    return `${base}（广告暂未开放）`;
  }
  return AdQuota.canShow(scene)
    ? `${base}（剩余 ${AdQuota.remaining(scene)} 次）`
    : `${base}（今日已达上限）`;
}
