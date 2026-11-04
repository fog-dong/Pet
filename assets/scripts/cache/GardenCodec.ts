// STATUS: implemented, W25 P2-C 后院地块与每日计数编解码（纯函数；计时只走本地墙钟，草药不兑换金币/爱心）
import { toNonNegativeInt } from './SaveFields';

export interface GardenPlot {
  /** 地块序号（0 起）；`SaveData.garden` 的长度就是已开垦块数，锁定地块不落存档。 */
  index: number;
  /** 当前作物 id；空串表示空地。 */
  cropId: string;
  plantedAt: number;
  readyAt: number;
  /** 当日浇水计数与日期键（与 `todayKey()` 同格式），跨天视为 0。 */
  waterDay: string;
  waterCount: number;
}

/** 后院每日计数：一块地不细分，收获/合成共用同一个日期键。 */
export interface GardenQuota {
  day: string;
  harvest: number;
  craft: number;
}

export function emptyGardenQuota(): GardenQuota {
  return { day: '', harvest: 0, craft: 0 };
}

export function emptyPlot(index: number): GardenPlot {
  return { index, cropId: '', plantedAt: 0, readyAt: 0, waterDay: '', waterCount: 0 };
}

function timeOf(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** 解码只收敛类型与范围，不判断作物是否存在；序号按落盘顺序重排，避免脏档出现空洞。 */
export function decodeGarden(value: unknown): GardenPlot[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const rows: GardenPlot[] = [];
  value.forEach((raw) => {
    if (!raw || typeof raw !== 'object') {
      return;
    }
    const item = raw as Partial<GardenPlot>;
    rows.push({
      index: 0,
      cropId: typeof item.cropId === 'string' ? item.cropId : '',
      plantedAt: timeOf(item.plantedAt),
      readyAt: timeOf(item.readyAt),
      waterDay: typeof item.waterDay === 'string' ? item.waterDay : '',
      waterCount: Math.min(99, toNonNegativeInt(item.waterCount, 0)),
    });
  });
  return rows.map((row, index) => ({ ...row, index }));
}

export function decodeGardenQuota(value: unknown): GardenQuota {
  if (!value || typeof value !== 'object') {
    return emptyGardenQuota();
  }
  const item = value as Partial<GardenQuota>;
  return {
    day: typeof item.day === 'string' ? item.day : '',
    harvest: toNonNegativeInt(item.harvest, 0),
    craft: toNonNegativeInt(item.craft, 0),
  };
}
