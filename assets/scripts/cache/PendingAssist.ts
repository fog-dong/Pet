// STATUS: implemented, W7 助力补发队列（网络失败先本地到账，登录后重试）
import { sys } from 'cc';

const KEY = 'pet_pending_assist_v1';
const MAX_ITEMS = 10;

export interface PendingAssist {
  friendOpenid: string;
  resourceType: string;
  scene: string;
  nonce: string;
}

function isPending(value: unknown): value is PendingAssist {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.friendOpenid === 'string' &&
    typeof record.resourceType === 'string' &&
    typeof record.scene === 'string' &&
    typeof record.nonce === 'string'
  );
}

function load(): PendingAssist[] {
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

function save(list: readonly PendingAssist[]): void {
  if (list.length === 0) {
    sys.localStorage.removeItem(KEY);
    return;
  }
  sys.localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_ITEMS)));
}

export function enqueueAssist(item: PendingAssist): void {
  const list = load().filter((entry) => entry.nonce !== item.nonce);
  list.push(item);
  save(list);
}

export function readPendingAssist(): PendingAssist[] {
  return load();
}

export function removePendingAssist(nonce: string): void {
  save(load().filter((entry) => entry.nonce !== nonce));
}
