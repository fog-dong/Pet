// STATUS: implemented, W14-1 每日 9 点扫描 sync_pending 积压（只读，不修改任何数据；P2 运营监控）
// API: 无客户端调用，仅由定时触发器调用，见 docs/plan/W14-积压监控操作单.md
import * as cloud from 'wx-server-sdk';

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

/** 与客户端 PendingTtl 同口径：7 天过期；剩余 ≤2 天算「即将过期」。 */
const PENDING_TTL_MS = 7 * 24 * 3600 * 1000;
const NEAR_EXPIRY_MS = 2 * 24 * 3600 * 1000;
const COLLECTION = 'sync_pending';

interface CloudResponse<T> {
  code: number;
  msg: string;
  data: T | null;
  serverTime?: number;
}

interface MonitorData {
  total: number;
  nearExpiry: number;
  expired: number;
}

export async function main(): Promise<CloudResponse<MonitorData>> {
  const db = cloud.database();
  const now = Date.now();
  const expiredBefore = now - PENDING_TTL_MS;
  const nearBefore = now - (PENDING_TTL_MS - NEAR_EXPIRY_MS);
  const collection = db.collection(COLLECTION);
  const [all, expired, nearOrExpired] = await Promise.all([
    collection.count(),
    collection.where({ firstSeenAt: db.command.lte(expiredBefore) }).count(),
    collection.where({ firstSeenAt: db.command.lte(nearBefore) }).count(),
  ]);
  const data: MonitorData = {
    total: all.total,
    nearExpiry: nearOrExpired.total - expired.total,
    expired: expired.total,
  };
  // 只有老化才打 warn：控制台日志检索 pending_aging 即可定位，不需要自定义业务指标。
  if (data.nearExpiry > 0 || data.expired > 0) {
    console.warn(JSON.stringify({ event: 'pending_aging', ...data }));
  }
  return { code: 0, msg: 'ok', data, serverTime: now };
}
