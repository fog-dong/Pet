// STATUS: implemented, W5 云函数；W21 支持 Axum HTTP（EnvConfig.resolveApiBase）
// API: Net.call, see docs/plan/接口冻结清单.md §1
import { isCloudEnabled, resolveApiBase, resolveCloudEnv } from '../config/EnvConfig';
import { invokeCloud } from './NetCloud';
import { invokeHttp } from './NetHttp';

export interface NetResponse<T> {
  code: number;
  msg: string;
  data: T | null;
  serverTime?: number;
}

export interface NetOptions {
  timeoutMs?: number;
  retry?: number;
  idempotencyKey?: string;
}

export const NET_ERROR = {
  NETWORK: -1,
  TIMEOUT: -2,
  BAD_RESPONSE: -3,
} as const;

type Transport = 'none' | 'cloud' | 'http';

export class NetworkClient {
  private transport: Transport = 'none';
  private apiBase = '';

  get ready(): boolean {
    return this.transport !== 'none';
  }

  /** HTTP 模式时 login 必须带 wx.login code。 */
  get usesHttp(): boolean {
    return this.transport === 'http';
  }

  init(_env?: string): boolean {
    if (this.transport !== 'none') {
      return true;
    }
    if (!isCloudEnabled()) {
      return false;
    }
    const base = resolveApiBase();
    if (base.length > 0) {
      this.apiBase = base;
      this.transport = 'http';
      return true;
    }
    const env = resolveCloudEnv();
    if (!env || typeof wx === 'undefined' || !wx.cloud) {
      return false;
    }
    try {
      wx.cloud.init({ env, traceUser: true });
    } catch {
      return false;
    }
    this.transport = 'cloud';
    return true;
  }

  async call<T>(
    name: string,
    data: Record<string, unknown> = {},
    options: NetOptions = {},
  ): Promise<NetResponse<T>> {
    if (!name) {
      return this.failure<T>(NET_ERROR.BAD_RESPONSE, 'EMPTY_FUNCTION_NAME');
    }
    if (this.transport === 'none') {
      return this.failure<T>(NET_ERROR.NETWORK, 'NET_NOT_READY');
    }

    const timeoutMs = options.timeoutMs ?? 8000;
    const retries = options.retry ?? 2;
    const payload = options.idempotencyKey
      ? { ...data, idempotencyKey: options.idempotencyKey }
      : data;

    let last: NetResponse<T> | null = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const raw =
          this.transport === 'http'
            ? await invokeHttp(this.apiBase, name, payload, timeoutMs)
            : await invokeCloud(name, payload, timeoutMs);
        const parsed = this.parse<T>(raw);
        if (parsed.code === 0 || !this.isRetryable(parsed.code)) {
          return parsed;
        }
        last = parsed;
      } catch (error: unknown) {
        const timedOut = error instanceof Error && error.message === 'NET_TIMEOUT';
        last = this.failure<T>(
          timedOut ? NET_ERROR.TIMEOUT : NET_ERROR.NETWORK,
          timedOut ? 'NET_TIMEOUT' : 'NETWORK_ERROR',
        );
      }
      if (attempt < retries) {
        await this.delay(attempt);
      }
    }
    return last ?? this.failure<T>(NET_ERROR.NETWORK, 'NETWORK_ERROR');
  }

  private parse<T>(raw: WxCloudCallResult): NetResponse<T> {
    const value = raw && typeof raw === 'object' ? raw.result : undefined;
    if (!value || typeof value !== 'object') {
      return this.failure<T>(NET_ERROR.BAD_RESPONSE, 'BAD_RESPONSE');
    }
    const record = value as Record<string, unknown>;
    const code = typeof record.code === 'number' ? record.code : NET_ERROR.BAD_RESPONSE;
    const msg = typeof record.msg === 'string' ? record.msg : 'UNKNOWN';
    const data = (record.data ?? null) as T | null;
    const serverTime =
      typeof record.serverTime === 'number' ? record.serverTime : undefined;
    return { code, msg, data, serverTime };
  }

  private isRetryable(code: number): boolean {
    return code < 0;
  }

  private failure<T>(code: number, msg: string): NetResponse<T> {
    return { code, msg, data: null };
  }

  private delay(attempt: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, 1000 * (attempt + 1));
    });
  }
}

export const Net = new NetworkClient();
