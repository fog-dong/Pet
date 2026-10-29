// STATUS: scaffold, API frozen by architect on 2026-10-29
// API: saveGame, see docs/plan/接口冻结清单.md §2.3
import * as cloud from 'wx-server-sdk';

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

interface CloudResponse<T> {
  code: number;
  msg: string;
  data: T | null;
  serverTime?: number;
}

interface SaveGameEvent {
  revision?: unknown;
  snapshot?: unknown;
}

interface SaveGameData {
  revision: number;
  serverTime: number;
}

function ok<T>(data: T): CloudResponse<T> {
  return { code: 0, msg: 'ok', data, serverTime: Date.now() };
}

function fail<T>(code: number, msg: string): CloudResponse<T> {
  return { code, msg, data: null, serverTime: Date.now() };
}

export async function main(event: SaveGameEvent): Promise<CloudResponse<SaveGameData>> {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return fail<SaveGameData>(1001, 'SESSION_INVALID');
  }

  const revision = event.revision;
  if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 0) {
    return fail<SaveGameData>(1002, 'INVALID_PARAM');
  }

  const snapshot = event.snapshot;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return fail<SaveGameData>(1002, 'INVALID_PARAM');
  }

  // W2: 读取当前 revision，revision <= current 返回 1004 + 最新值；事务写 users/hospital_state。
  return ok<SaveGameData>({ revision, serverTime: Date.now() });
}
