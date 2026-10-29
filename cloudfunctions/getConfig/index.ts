// STATUS: scaffold, API frozen by architect on 2026-10-29
// API: getConfig, see docs/plan/接口冻结清单.md §2.10
import * as cloud from 'wx-server-sdk';

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

interface CloudResponse<T> {
  code: number;
  msg: string;
  data: T | null;
  serverTime?: number;
}

interface GetConfigEvent {
  version?: unknown;
  grayTags?: unknown;
}

interface GetConfigData {
  version: number;
  configs: Record<string, unknown>;
  forceUpdate: boolean;
  minVersion: string;
}

function ok<T>(data: T): CloudResponse<T> {
  return { code: 0, msg: 'ok', data, serverTime: Date.now() };
}

function fail<T>(code: number, msg: string): CloudResponse<T> {
  return { code, msg, data: null, serverTime: Date.now() };
}

export async function main(event: GetConfigEvent): Promise<CloudResponse<GetConfigData>> {
  if (event.version !== undefined && (typeof event.version !== 'number' || event.version < 0)) {
    return fail<GetConfigData>(1002, 'INVALID_PARAM');
  }

  const grayTags = event.grayTags;
  if (grayTags !== undefined) {
    if (!Array.isArray(grayTags) || grayTags.some((tag) => typeof tag !== 'string')) {
      return fail<GetConfigData>(1002, 'INVALID_PARAM');
    }
  }

  // W2: 从 config 读取 active 版本并按 grayTags 命中；W1 返回空配置，不伪造线上配置。
  return ok<GetConfigData>({
    version: 0,
    configs: {},
    forceUpdate: false,
    minVersion: '0.0.0',
  });
}
