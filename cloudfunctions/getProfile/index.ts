// STATUS: scaffold, API frozen by architect on 2026-10-29
// API: getProfile, see docs/plan/接口冻结清单.md §2.2
import * as cloud from 'wx-server-sdk';

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

interface CloudResponse<T> {
  code: number;
  msg: string;
  data: T | null;
  serverTime?: number;
}

interface ProfileData {
  user: null;
  hospital: null;
  resources: null;
  collection: null;
}

function ok<T>(data: T): CloudResponse<T> {
  return { code: 0, msg: 'ok', data, serverTime: Date.now() };
}

function fail<T>(code: number, msg: string): CloudResponse<T> {
  return { code, msg, data: null, serverTime: Date.now() };
}

export async function main(): Promise<CloudResponse<ProfileData>> {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return fail<ProfileData>(1001, 'SESSION_INVALID');
  }

  // W2: 汇总 users / hospital_state / pets / adoptions；W1 返回空结构，不伪造数据。
  return ok<ProfileData>({ user: null, hospital: null, resources: null, collection: null });
}
