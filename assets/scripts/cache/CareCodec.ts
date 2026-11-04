// STATUS: implemented, W25 P2-D 护理每日计数编解码（纯函数；与 gardenQuota 同口径，跨天视为 0）
import { toNonNegativeInt } from './SaveFields';

/** 剪指甲 / 驱虫共用同一个日期键；跨天不需要重置动作。 */
export interface CareQuota {
  day: string;
  nail: number;
  deworm: number;
}

export function emptyCareQuota(): CareQuota {
  return { day: '', nail: 0, deworm: 0 };
}

export function decodeCareQuota(value: unknown): CareQuota {
  if (!value || typeof value !== 'object') {
    return emptyCareQuota();
  }
  const item = value as Partial<CareQuota>;
  return {
    day: typeof item.day === 'string' ? item.day : '',
    nail: toNonNegativeInt(item.nail, 0),
    deworm: toNonNegativeInt(item.deworm, 0),
  };
}
