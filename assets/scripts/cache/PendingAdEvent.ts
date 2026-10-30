// STATUS: implemented, W8 广告事件补发队列（离线/网络失败入队，下次启动重试）
import { sys } from 'cc';

const KEY = 'pet_pending_ad_events_v1';
const MAX_ITEMS = 20;

export interface PendingAdEvent {
  adSessionId: string;
  adUnitId: string;
  scene: string;
  isEnded: boolean;
}

function isPending(value: unknown): value is PendingAdEvent {
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

function load(): PendingAdEvent[] {
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

function save(list: readonly PendingAdEvent[]): void {
  if (list.length === 0) {
    sys.localStorage.removeItem(KEY);
    return;
  }
  sys.localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_ITEMS)));
}

/** 同一广告会话只保留一条，避免断网期间反复点击撑爆队列。 */
export function enqueueAdEvent(item: PendingAdEvent): void {
  const list = load().filter((entry) => entry.adSessionId !== item.adSessionId);
  list.push(item);
  save(list);
}

export function readPendingAdEvents(): PendingAdEvent[] {
  return load();
}

export function removePendingAdEvent(adSessionId: string): void {
  save(load().filter((entry) => entry.adSessionId !== adSessionId));
}
