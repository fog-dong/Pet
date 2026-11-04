// STATUS: implemented, W25 P2-C 后院纯规则（生长/浇水/限额/开垦价；只依赖类型，可被 Node strip-types 直接回归）
import type { CropConfig } from '../config/GardenDefaults';
import type { GardenPlot, GardenQuota } from '../cache/GardenCodec';

export const MINUTE_MS = 60 * 1000;

/** 墙钟只向前：系统时间回拨时停在上次水位，作物不会因回拨反复刷新生长。 */
export function forwardNow(wallClock: number, stamp: number): number {
  return Math.max(Math.floor(wallClock), Math.max(0, Math.floor(stamp)));
}

export function growMs(crop: Pick<CropConfig, 'growMinutes'>): number {
  return Math.max(1, Math.floor(crop.growMinutes)) * MINUTE_MS;
}

export function matureAt(now: number, crop: Pick<CropConfig, 'growMinutes'>): number {
  return now + growMs(crop);
}

/** 浇水只扣剩余 CD：扣到负数说明刚好成熟，允许立即收获。 */
export function wateredReadyAt(readyAt: number, minutesSaved: number): number {
  return Math.max(0, Math.floor(readyAt - Math.max(0, minutesSaved) * MINUTE_MS));
}

export function remainingMs(readyAt: number, now: number): number {
  return Math.max(0, Math.floor(readyAt - now));
}

export function isReady(plot: GardenPlot, now: number): boolean {
  return plot.cropId !== '' && plot.readyAt > 0 && now >= plot.readyAt;
}

/** 当日已用次数；日期键不一致（跨天）直接归零，不需要额外的重置动作。 */
export function quotaUsed(quota: GardenQuota, day: string): { harvest: number; craft: number } {
  if (quota.day !== day) {
    return { harvest: 0, craft: 0 };
  }
  return { harvest: Math.max(0, quota.harvest), craft: Math.max(0, quota.craft) };
}

export function waterUsed(plot: GardenPlot, day: string): number {
  return plot.waterDay === day ? Math.max(0, plot.waterCount) : 0;
}

/** `limit <= 0` 视为关闭该玩法，剩余次数给 0（调用方据此置灰）。 */
export function limitLeft(used: number, limit: number): number {
  if (limit <= 0) {
    return 0;
  }
  return Math.max(0, limit - used);
}

/** 下一块地的价格：按「已买块数」索引 costs；已开满或配置缺价返回 null。 */
export function nextPlotCost(length: number, unlocked: number, costs: readonly number[], max: number): number | null {
  if (length >= max) {
    return null;
  }
  const bought = Math.max(0, length - unlocked);
  const cost = costs[bought];
  return typeof cost === 'number' && Number.isFinite(cost) ? Math.max(0, Math.floor(cost)) : null;
}

/** 倒计时展示：>=1 小时给「x小时y分」，否则「x分」；已到点给「已成熟」。 */
export function formatRemaining(ms: number): string {
  const minutes = Math.ceil(Math.max(0, ms) / MINUTE_MS);
  if (minutes <= 0) {
    return '已成熟';
  }
  if (minutes < 60) {
    return `${minutes}分`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}小时${rest}分` : `${hours}小时`;
}
