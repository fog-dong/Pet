// STATUS: implemented
// API: login, see docs/plan/接口冻结清单.md §2.1
import * as cloud from 'wx-server-sdk';
import { createHmac } from 'crypto';

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

interface UserDoc {
  openid?: string;
}

interface NodeProcess {
  env?: Record<string, string | undefined>;
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function ok<T>(data: T): CloudResponse<T> {
  return { code: 0, msg: 'ok', data, serverTime: Date.now() };
}

function fail<T>(code: number, msg: string): CloudResponse<T> {
  return { code, msg, data: null, serverTime: Date.now() };
}

function sessionSecret(): string {
  const nodeProcess = (globalThis as unknown as { process?: NodeProcess }).process;
  const secret = nodeProcess?.env?.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET_MISSING');
  }
  return secret;
}

// token 只绑定 openid 与过期时间，不在客户端可解码的载荷里放 openid。
function signToken(openid: string, expiresAt: number): string {
  const signature = createHmac('sha256', sessionSecret()).update(`${openid}.${expiresAt}`).digest('hex');
  return `${expiresAt}.${signature}`;
}

async function createUser(openid: string, scene: string, now: number): Promise<boolean> {
  const db = cloud.database();
  const users = db.collection<UserDoc>('users');
  try {
    await users.add({
      data: {
        _id: openid,
        openid,
        createdAt: now,
        lastLoginAt: now,
        lastScene: scene,
        status: 'active',
        revision: 0,
        resources: {
          coins: 0,
          hearts: 0,
          beds: 0,
          medicine: {},
          trainingPoints: 0,
          fragments: 0,
          updatedAt: now,
        },
        reputation: 0,
        flags: {},
      },
    });
  } catch {
    const existing = await users.where({ openid }).limit(1).get();
    if (existing.data.length === 0) {
      throw new Error('USER_CREATE_FAILED');
    }
    return false;
  }

  await db.collection('hospital_state').doc(openid).set({
    data: {
      openid,
      level: 1,
      beds: 0,
      rooms: [],
      doctors: [],
      decorations: [],
      adoptionSlots: 0,
      reputation: 0,
      seasonState: {},
      revision: 0,
      updatedAt: now,
    },
  });
  return true;
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
  if (event.scene !== undefined && typeof event.scene !== 'string') {
    return fail<LoginData>(1002, 'INVALID_PARAM');
  }
  if (event.version !== undefined && typeof event.version !== 'string') {
    return fail<LoginData>(1002, 'INVALID_PARAM');
  }

  const now = Date.now();
  const scene = typeof event.scene === 'string' ? event.scene : '';
  const users = cloud.database().collection<UserDoc>('users');
  const found = await users.where({ openid: OPENID }).limit(1).get();
  let isNewUser = false;

  if (found.data.length === 0) {
    isNewUser = await createUser(OPENID, scene, now);
  } else {
    await users.where({ openid: OPENID }).update({ data: { lastLoginAt: now, lastScene: scene } });
  }

  return ok<LoginData>({
    token: signToken(OPENID, now + SESSION_TTL_MS),
    isNewUser,
    serverTime: now,
    minVersion: '0.0.0',
  });
}
