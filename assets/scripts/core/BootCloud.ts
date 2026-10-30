// STATUS: implemented, W11-2 隐私同意后的云同步入口（游客模式不初始化云端；补同意后返回云端是否就绪）
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

/**
 * 大厅/关于面板补同意后启动云端。返回云端是否就绪：云环境仍是占位时保持本地模式，不阻塞单局。
 * 登录失败只在 syncCloud 里记一笔：acceptedVersion 已落盘，下次启动会重跑本流程。
 */
export function startCloudSync(): boolean {
  if (Net.init(CLOUD_ENV)) {
    void syncCloud();
    return true;
  }
  Track.track('boot_cloud_offline_fallback');
  return false;
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
    // 失败即视为 pending：Net 层已内建 8s 超时 + 2 次重试，仍失败则等下次启动按已同意状态重跑。
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
