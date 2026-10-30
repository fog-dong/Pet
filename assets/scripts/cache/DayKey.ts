// STATUS: implemented, W5 本地日期键（每日上限与领养日期统一口径）
export function todayKey(): string {
  const date = new Date();
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
