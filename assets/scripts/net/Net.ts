// STATUS: implemented, W5 真实云函数调用（8s 超时 + 2 次重试 + 失败返回错误码不抛错）
// API: Net.call, see docs/plan/接口冻结清单.md §1

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

export class NetworkClient {
  private initialized = false;

  /** 云端可用时才允许补发队列，避免本地模式下反复失败。 */
  get ready(): boolean {
    return this.initialized;
  }

  init(env: string): boolean {
    if (this.initialized) {
      return true;
    }
    if (!env || env === 'ENV_PLACEHOLDER') {
      return false;
    }
    wx.cloud.init({ env, traceUser: true });
    this.initialized = true;
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

    const timeoutMs = options.timeoutMs ?? 8000;
    const retries = options.retry ?? 2;
    const payload = options.idempotencyKey
      ? { ...data, idempotencyKey: options.idempotencyKey }
      : data;

    let last: NetResponse<T> | null = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const raw = await this.invoke(name, payload, timeoutMs);
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

  private invoke(
    name: string,
    data: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<WxCloudCallResult> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error('NET_TIMEOUT'));
        }
      }, timeoutMs);

      wx.cloud
        .callFunction({ name, data })
        .then((result) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(result);
          }
        })
        .catch((error: unknown) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(error instanceof Error ? error : new Error('NETWORK_ERROR'));
          }
        });
    });
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
