// STATUS: implemented, W10-2 云端开关 + W21 Axum HTTP 后端覆盖位
// W10-2 人工侧占位集中：CLOUD_ENV 是云开发环境 ID 的唯一入口，占位值判定也只在这里定义。
// W20-3 补一个本地覆盖位（resolveCloudEnv）：联调不必改源码，提审仍要把真实环境 ID 落到 CLOUD_ENV。
// W21：`API_BASE_URL` 覆盖位优先；有值时走 Axum HTTP，不再依赖微信云开发。
import { sys } from 'cc';

export const CLOUD_ENV_PLACEHOLDER = 'ENV_PLACEHOLDER';
export const CLOUD_ENV = CLOUD_ENV_PLACEHOLDER;
/**
 * 联调用环境 ID 的本地覆盖位：真机/开发者工具里执行
 * `wx.setStorageSync('pet_cloud_env_v1', '<真实环境 ID>')` 即可接通云端，
 * 不必改这行源码，也就不会把环境 ID 误提交。清掉这个 key 立刻回到本地模式。
 */
export const CLOUD_ENV_OVERRIDE_KEY = 'pet_cloud_env_v1';
/** Axum 后端根地址覆盖位，例如 `https://pet.example.com`（不要尾斜杠）。 */
export const API_BASE_OVERRIDE_KEY = 'pet_api_base_v1';
export const CLIENT_VERSION = '0.1.0';
// 灰度渠道标签；W2 固定 dev，真机渠道识别在 W3 由 net 层补齐。
export const CLIENT_CHANNEL: 'android' | 'ios' | 'dev' = 'dev';

/**
 * 云端总开关：HTTP 后端或云开发任一可用即为 true。
 * `Net.init` 唯一消费它，成功后 `Net.ready` 才为 true。
 */
export function isCloudEnabled(): boolean {
  if (resolveApiBase().length > 0) {
    return true;
  }
  const env = resolveCloudEnv();
  return env.length > 0 && env !== CLOUD_ENV_PLACEHOLDER;
}

/** 真实环境 ID 的取值顺序：本地覆盖 key > 源码常量；两者都是占位时返回占位值。 */
export function resolveCloudEnv(): string {
  const override = readStorage(CLOUD_ENV_OVERRIDE_KEY);
  return override || CLOUD_ENV;
}

/** Axum 根地址；未配置返回空串。 */
export function resolveApiBase(): string {
  return readStorage(API_BASE_OVERRIDE_KEY).replace(/\/$/, '');
}

function readStorage(key: string): string {
  try {
    const raw = sys.localStorage.getItem(key);
    return typeof raw === 'string' ? raw.replace(/^"|"$/g, '').trim() : '';
  } catch {
    return '';
  }
}
