// STATUS: scaffold, API frozen by architect on 2026-10-29
// API: login, see docs/plan/接口冻结清单.md §2.1
import * as cloud from 'wx-server-sdk';

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

interface CloudResponse<T> {
  code: number;
  msg: string;
  data: T | null;
  serverTime?: number;
}

interface LoginEvent {
  scene?: unknown;
  version?: unknown;
  channel?: unknown;
}

interface LoginData {
  token: string;
  isNewUser: boolean;
  serverTime: number;
  minVersion: string;
}

function ok<T>(data: T): CloudResponse<T> {
  return { code: 0, msg: 'ok', data, serverTime: Date.now() };
}

function fail<T>(code: number, msg: string): CloudResponse<T> {
  return { code, msg, data: null, serverTime: Date.now() };
}

export async function main(event: LoginEvent): Promise<CloudResponse<LoginData>> {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return fail<LoginData>(1001, 'SESSION_INVALID');
  }

  const channel = event.channel;
  if (channel !== undefined && channel !== 'android' && channel !== 'ios' && channel !== 'dev') {
    return fail<LoginData>(1002, 'INVALID_PARAM');
  }

  // W2: 查询/创建 users，签发会话 token；W1 不写库，返回占位结构。
  return ok<LoginData>({
    token: '',
    isNewUser: false,
    serverTime: Date.now(),
    minVersion: '0.0.0',
  });
}
