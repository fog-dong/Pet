// STATUS: implemented, W10-5 广告事件补发队列（离线/网络失败入队；超过 7 天过期即从本地清掉，W16）
import { sys } from 'cc';
import { isPendingExpired } from './PendingTtl';

const KEY = 'pet_pending_ad_events_v1';
const MAX_ITEMS = 20;

export interface PendingAdEvent {
  adSessionId: string;
  adUnitId: string;
  scene: string;
  isEnded: boolean;
}

/** 落盘结构比上行结构多一个入队时间，出队时剥掉，保证上行字段仍是冻结口径。 */
type StoredEvent = PendingAdEvent & { enqueuedAt: number };

function isPending(value: unknown): value is StoredEvent {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.adSessionId === 'string' &&
    typeof record.adUnitId === 'string' &&
    typeof record.scene === 'string' &&
    typeof record.isEnded === 'boolean'
  );
}

function load(): StoredEvent[] {
  const raw = sys.localStorage.getItem(KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isPending) : [];
  } catch {
    return [];
  }
}

function save(list: readonly StoredEvent[]): void {
  if (list.length === 0) {
    sys.localStorage.removeItem(KEY);
    return;
  }
  sys.localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_ITEMS)));
}

/** 同一广告会话只保留一条，避免断网期间反复点击撑爆队列。 */
export function enqueueAdEvent(item: PendingAdEvent): void {
  const list = load().filter((entry) => entry.adSessionId !== item.adSessionId);
  list.push({ ...item, enqueuedAt: Date.now() });
  save(list);
}

/** 读取即淘汰：过期项顺手写回本地，游客期的队列不会只增不清。 */
export function readPendingAdEvents(): PendingAdEvent[] {
  const all = load();
  const fresh = all.filter((entry) => !isPendingExpired(entry.enqueuedAt));
  if (fresh.length !== all.length) {
    save(fresh);
  }
  return fresh.map(({ adSessionId, adUnitId, scene, isEnded }) => ({ adSessionId, adUnitId, scene, isEnded }));
}

export function removePendingAdEvent(adSessionId: string): void {
  save(load().filter((entry) => entry.adSessionId !== adSessionId));
}
