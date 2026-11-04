// STATUS: implemented, W25 P2-A3 存档解码工具（从 SaveCodec 抽出，压住 150 行红线）
// 口径：存档是玩家可改的本地数据，解码只做「类型与范围收敛」，不做业务校验。

/** 非有限数（含字符串、null、NaN）一律回落到默认值。 */
export function toNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** 非数组给空表，数组里只保留字符串项。 */
export function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** 物品/星级/好感度这类 id→数量表：丢掉脏值，避免 NaN 进 UI。 */
export function toNumberMap(value: unknown): Record<string, number> {
  const result: Record<string, number> = {};
  if (!value || typeof value !== 'object') {
    return result;
  }
  const source = value as Record<string, unknown>;
  for (const key in source) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      continue;
    }
    const raw = source[key];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      result[key] = raw;
    }
  }
  return result;
}

/** id→字符串表（领养日期、寄语等）。 */
export function toStringMap(value: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (!value || typeof value !== 'object') {
    return result;
  }
  const source = value as Record<string, unknown>;
  for (const key in source) {
    if (!Object.prototype.hasOwnProperty.call(source, key) || typeof source[key] !== 'string') {
      continue;
    }
    result[key] = source[key] as string;
  }
  return result;
}

/** 口碑与爱心同属「不能扣成负数」的资源；上报前再收敛一次，免得整份快照被判 INVALID_PARAM。 */
export function toNonNegativeInt(value: unknown, fallback: number): number {
  return Math.max(0, Math.floor(toNumber(value, fallback)));
}
