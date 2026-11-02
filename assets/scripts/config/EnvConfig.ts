// STATUS: scaffold, API frozen by architect on 2026-10-29
// W10-2 人工侧占位集中：CLOUD_ENV 是云开发环境 ID 的唯一入口，占位值判定也只在这里定义。
// W20-3 补一个本地覆盖位（resolveCloudEnv）：联调不必改源码，提审仍要把真实环境 ID 落到 CLOUD_ENV。
// 提审前必须替换：把 CLOUD_ENV 换成微信开发者工具「云开发」控制台里的真实环境 ID。
import { sys } from 'cc';

export const CLOUD_ENV_PLACEHOLDER = 'ENV_PLACEHOLDER';
export const CLOUD_ENV = CLOUD_ENV_PLACEHOLDER;
/**
 * 联调用环境 ID 的本地覆盖位：真机/开发者工具里执行
 * `wx.setStorageSync('pet_cloud_env_v1', '<真实环境 ID>')` 即可接通云端，
 * 不必改这行源码，也就不会把环境 ID 误提交。清掉这个 key 立刻回到本地模式。
 */
export const CLOUD_ENV_OVERRIDE_KEY = 'pet_cloud_env_v1';
export const CLIENT_VERSION = '0.1.0';
// 灰度渠道标签；W2 固定 dev，真机渠道识别在 W3 由 net 层补齐。
export const CLIENT_CHANNEL: 'android' | 'ios' | 'dev' = 'dev';

/**
 * 云端总开关：占位或缺配时为 false。
 * `Net.init` 唯一消费它，成功后 `Net.ready` 才为 true；
 * getProfile / leaderboard / assist / adEvent / syncCaseResult / saveGame / trackEvent
 * 全部以 `Net.ready` 短路，因此这里为 false 时一律走本地兜底，不发请求、不报错、不阻塞单局。
 */
export function isCloudEnabled(): boolean {
  const env = resolveCloudEnv();
  return env.length > 0 && env !== CLOUD_ENV_PLACEHOLDER;
}

/** 真实环境 ID 的取值顺序：本地覆盖 key > 源码常量；两者都是占位时返回占位值。 */
export function resolveCloudEnv(): string {
  const override = readOverride();
  return override || CLOUD_ENV;
}

/** 读不到（平台禁用 storage）就当没有覆盖，绝不让启动流程抛错。 */
function readOverride(): string {
  try {
    const raw = sys.localStorage.getItem(CLOUD_ENV_OVERRIDE_KEY);
    return typeof raw === 'string' ? raw.replace(/^"|"$/g, '').trim() : '';
  } catch {
    return '';
  }
}
