// STATUS: implemented, W9-4 隐私同意后的云同步入口（游客模式不初始化云端）
import { Net } from '../net/Net';
import { Session } from '../net/Session';
import { flushPending } from '../net/SyncCaseResult';
import { retryPendingSave } from '../net/CloudSave';
import { flushPendingAssist } from '../net/AssistSync';
import { flushPendingAdEvents } from '../net/AdEvent';
import { Profile } from '../net/Profile';
import { WxPrivacy } from '../net/Privacy';
import { PrivacyState } from '../cache/PrivacyState';
import { Quality } from '../config/Quality';
import { CLIENT_CHANNEL, CLIENT_VERSION, CLOUD_ENV } from '../config/EnvConfig';
import { LEGAL_VERSION } from '../config/LegalConfig';
import { Track } from '../track/Track';

interface LoginData {
  token: string;
  isNewUser: boolean;
  serverTime: number;
  minVersion: string;
}

interface GetConfigData {
  version: number;
  configs: Record<string, unknown>;
  forceUpdate: boolean;
  minVersion: string;
}

/** 同意协议：落盘 + 请求平台隐私授权；云端何时启动由调用方决定。 */
export function agreePrivacy(): void {
  PrivacyState.markAccepted();
  Track.track('privacy_agree', { version: LEGAL_VERSION });
  void WxPrivacy.request();
}

/** 大厅内补同意后再启动云端；未配置云环境时保持本地模式，不阻塞单局。 */
export function startCloudSync(): void {
  if (Net.init(CLOUD_ENV)) {
    void syncCloud();
    return;
  }
  Track.track('boot_cloud_offline_fallback');
}

/** 云端功能开关：游客模式（未同意当前协议）或云端未初始化时，一律不开启云端玩法。 */
export function cloudFeaturesAllowed(): boolean {
  return Net.ready && PrivacyState.accepted();
}

/**
 * 进厅后跑：登录拿 token → 补发离线队列 → 拉云资料 → 拉远端配置。
 * 全程不 await 场景加载，网络慢时玩家仍能进大厅看本地内容；只在同意隐私后被调用。
 */
export async function syncCloud(): Promise<void> {
  const login = await Net.call<LoginData>('login', {
    version: CLIENT_VERSION,
    channel: CLIENT_CHANNEL,
  });
  if (login.code !== 0 || !login.data) {
    Track.track('boot_login_failed', { code: login.code });
    return;
  }
  Session.set(login.data.token);
  void flushPending();
  void retryPendingSave();
  void flushPendingAssist();
  void flushPendingAdEvents();
  // login 会建用户记录，云资料放在它之后拉一次，避免首次启动拿到空快照。
  void Profile.refresh();

  const config = await Net.call<GetConfigData>('getConfig', { version: 0 });
  if (config.code === 0 && config.data) {
    Quality.set(config.data.configs.quality);
    return;
  }
  Track.track('boot_config_failed', { code: config.code });
}
