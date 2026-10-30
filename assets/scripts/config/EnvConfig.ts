// STATUS: scaffold, API frozen by architect on 2026-10-29
// W10-2 人工侧占位集中：CLOUD_ENV 是云开发环境 ID 的唯一入口，占位值判定也只在这里定义。
// 提审前必须替换：把 CLOUD_ENV 换成微信开发者工具「云开发」控制台里的真实环境 ID。
export const CLOUD_ENV_PLACEHOLDER = 'ENV_PLACEHOLDER';
export const CLOUD_ENV = CLOUD_ENV_PLACEHOLDER;
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
  return CLOUD_ENV.length > 0 && CLOUD_ENV !== CLOUD_ENV_PLACEHOLDER;
}
