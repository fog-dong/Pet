// STATUS: implemented, W10-5 助力补发队列（网络失败先本地到账；超过 7 天过期即清，W16）
import { sys } from 'cc';
import { isPendingExpired } from './PendingTtl';

const KEY = 'pet_pending_assist_v1';
const MAX_ITEMS = 10;

export interface PendingAssist {
  friendOpenid: string;
  resourceType: string;
  scene: string;
  nonce: string;
}

/** 落盘多一个入队时间，出队剥掉，上行字段保持冻结口径。 */
type StoredAssist = PendingAssist & { enqueuedAt: number };

function isPending(value: unknown): value is StoredAssist {
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

function load(): StoredAssist[] {
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

function save(list: readonly StoredAssist[]): void {
  if (list.length === 0) {
    sys.localStorage.removeItem(KEY);
    return;
  }
  sys.localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_ITEMS)));
}

export function enqueueAssist(item: PendingAssist): void {
  const list = load().filter((entry) => entry.nonce !== item.nonce);
  list.push({ ...item, enqueuedAt: Date.now() });
  save(list);
}

/** 读取即淘汰：助力按自然日计数，超期重发会记到错误的日期上。 */
export function readPendingAssist(): PendingAssist[] {
  const all = load();
  const fresh = all.filter((entry) => !isPendingExpired(entry.enqueuedAt));
  if (fresh.length !== all.length) {
    save(fresh);
  }
  return fresh.map(({ friendOpenid, resourceType, scene, nonce }) => ({ friendOpenid, resourceType, scene, nonce }));
}

export function removePendingAssist(nonce: string): void {
  save(load().filter((entry) => entry.nonce !== nonce));
}
