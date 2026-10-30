// STATUS: implemented, W10-5 待同步队列（落盘，下次启动补发；上限 20 条 + 7 天过期即清，W16）
import { sys } from 'cc';
import type { CaseSyncInput } from '../net/SyncCaseResult';
import { isPendingExpired } from './PendingTtl';

const CASE_KEY = 'pet_pending_case_v1';
const SAVE_KEY = 'pet_cloud_save_pending_v1';
const MAX_CASES = 20;

export interface PendingSave {
  revision: number;
  snapshot: Record<string, unknown>;
}

/** 落盘比上行结构多一个入队时间，出队时剥掉，`syncCaseResult` 的入参口径不变。 */
type StoredCase = CaseSyncInput & { enqueuedAt: number };

function readJson<T>(key: string): T | null {
  const raw = sys.localStorage.getItem(key);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    sys.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 本地容量满时放弃补发，不阻塞玩法。
  }
}

/** 按 caseSessionId 去重，超出上限丢弃最旧的一条。 */
export function enqueueCase(input: CaseSyncInput): void {
  const queue = readStoredCases().filter((item) => item.caseSessionId !== input.caseSessionId);
  queue.push({ ...input, enqueuedAt: Date.now() });
  writeJson(CASE_KEY, queue.slice(-MAX_CASES));
}

function readStoredCases(): StoredCase[] {
  const list = readJson<StoredCase[]>(CASE_KEY);
  if (!Array.isArray(list)) {
    return [];
  }
  return list.filter((item) => item && typeof item.caseSessionId === 'string');
}

/** 读取即淘汰：病例结果按周榜聚合，超期再传会记到错误的周上。 */
export function readCaseQueue(): CaseSyncInput[] {
  const all = readStoredCases();
  const fresh = all.filter((item) => !isPendingExpired(item.enqueuedAt));
  if (fresh.length !== all.length) {
    writeJson(CASE_KEY, fresh);
  }
  return fresh.map(({ caseSessionId, caseId, diagnosis, treatment, durationMs }) => ({
    caseSessionId,
    caseId,
    diagnosis,
    treatment,
    durationMs,
  }));
}

export function removeCase(caseSessionId: string): void {
  writeJson(
    CASE_KEY,
    readStoredCases().filter((item) => item.caseSessionId !== caseSessionId),
  );
}

export function readPendingSave(): PendingSave | null {
  const value = readJson<PendingSave>(SAVE_KEY);
  if (!value || typeof value.revision !== 'number' || !value.snapshot) {
    return null;
  }
  return value;
}

export function writePendingSave(save: PendingSave | null): void {
  if (!save) {
    sys.localStorage.removeItem(SAVE_KEY);
    return;
  }
  writeJson(SAVE_KEY, save);
}
