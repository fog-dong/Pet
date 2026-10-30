// STATUS: implemented, W10-5 补发队列过期口径（架构质检-W9 W16：游客期间积压的旧补发项不再无限期重试）
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 补发项最多保留 7 天：广告与助力按自然日计数、病例结果按周榜聚合，
 * 超期再传会把成绩记到错误的日期上，所以宁可丢掉这一条也不补发。
 */
export const PENDING_TTL_MS = 7 * DAY_MS;

/** 入队时间缺字段或非法时按最严格处理：旧版本写入的项一律视为已过期。 */
export function isPendingExpired(enqueuedAt: unknown, now = Date.now()): boolean {
  return typeof enqueuedAt !== 'number' || enqueuedAt <= 0 || now - enqueuedAt > PENDING_TTL_MS;
}
