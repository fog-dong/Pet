// STATUS: implemented
// API: saveGame, see docs/plan/接口冻结清单.md §2.3
import * as cloud from 'wx-server-sdk';
import { isNonNegativeInt, isPlainObject, readSnapshot } from './validate';

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

interface UserDoc {
  revision?: number;
}

interface HospitalStateDoc {
  revision?: number;
}

function ok<T>(data: T): CloudResponse<T> {
  return { code: 0, msg: 'ok', data, serverTime: Date.now() };
}

function fail<T>(code: number, msg: string): CloudResponse<T> {
  return { code, msg, data: null, serverTime: Date.now() };
}

function conflict<T>(data: T): CloudResponse<T> {
  return { code: 1004, msg: 'DUPLICATE', data, serverTime: Date.now() };
}

export async function main(event: SaveGameEvent): Promise<CloudResponse<SaveGameData>> {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return fail<SaveGameData>(1001, 'SESSION_INVALID');
  }

  const revision = event.revision;
  if (!isNonNegativeInt(revision) || revision < 1) {
    return fail<SaveGameData>(1002, 'INVALID_PARAM');
  }

  if (!isPlainObject(event.snapshot)) {
    return fail<SaveGameData>(1002, 'INVALID_PARAM');
  }

  const patch = readSnapshot(event.snapshot);
  if (!patch) {
    return fail<SaveGameData>(1002, 'INVALID_PARAM');
  }

  const now = Date.now();
  return cloud.database().runTransaction(async (transaction) => {
    const userRef = transaction.collection<UserDoc>('users').doc(OPENID);
    const user = (await userRef.get()).data;
    if (!user) {
      return fail<SaveGameData>(1001, 'SESSION_INVALID');
    }

    const stateRef = transaction.collection<HospitalStateDoc>('hospital_state').doc(OPENID);
    const state = (await stateRef.get()).data;
    const current = state && typeof state.revision === 'number' ? state.revision : 0;
    if (revision <= current) {
      return conflict<SaveGameData>({ revision: current, serverTime: now });
    }

    const statePatch: Record<string, unknown> = { ...patch.state, openid: OPENID, revision, updatedAt: now };
    if (state) {
      await stateRef.update({ data: statePatch });
    } else {
      await stateRef.set({ data: statePatch });
    }

    // W15-1：users.resources 只由 syncCaseResult 在事务内按服务端配置入账。
    // 客户端快照里的 resources 一律忽略：否则改本地存档即可直接改云端金币/爱心（W12-B 同源）。
    await userRef.update({ data: { revision } });

    return ok<SaveGameData>({ revision, serverTime: now });
  });
}
