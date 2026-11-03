// STATUS: implemented, W5 本地日期键（每日上限与领养日期统一口径）
export function todayKey(): string {
  const date = new Date();
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/**
 * 把 `todayKey()` 形态（不补零）的日期串解析回本地当天 00:00 的时间戳。
 * W22-3 用于按 `adoptedAt` 回填老档宠物的出生时间；非法输入返回 0，由调用方决定兜底。
 */
export function dayKeyToTime(key: string): number {
  const parts = String(key || '').split('-');
  if (parts.length !== 3) {
    return 0;
  }
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return 0;
  }
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31) {
    return 0;
  }
  const time = new Date(year, month - 1, day).getTime();
  return Number.isFinite(time) ? time : 0;
}
