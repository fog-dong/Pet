// STATUS: implemented, W11-2 隐私同意后的云同步入口（游客模式不初始化云端；补同意后返回云端是否就绪）
import { Net } from '../net/Net';
import { CloudResManager } from '../net/CloudResManager';
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
 * 大厅/关于面板补同意后启动云端。返回云环境是否就绪与「登录 + 补发」完成信号：
 * 升级入口据此当场刷新待同步角标，不必等下一次启动。
 */
export interface CloudSyncStart {
  /** 云环境是否已配置（同步可得）。 */
  readonly ready: boolean;
  /** login → 补发 → 拉配置全部跑完；云环境未配置时立即 resolve(false)。 */
  readonly done: Promise<boolean>;
}

export function startCloudSync(): CloudSyncStart {
  if (Net.init(CLOUD_ENV)) {
    return { ready: true, done: syncCloud() };
  }
  Track.track('boot_cloud_offline_fallback');
  return { ready: false, done: Promise.resolve(false) };
}

/**
 * 进厅后跑：登录拿 token → 补发离线队列 → 拉云资料 → 拉远端配置。
 * 全程不 await 场景加载，网络慢时玩家仍能进大厅看本地内容；只在同意隐私后被调用。
 * 返回 false 表示 login 失败（补发未执行），调用方可据此提示「暂时仍用本地存档」。
 */
export async function syncCloud(): Promise<boolean> {
  const login = await Net.call<LoginData>('login', {
    version: CLIENT_VERSION,
    channel: CLIENT_CHANNEL,
  });
  if (login.code !== 0 || !login.data) {
    // 失败即视为 pending：Net 层已内建 8s 超时 + 2 次重试，仍失败则等下次启动按已同意状态重跑。
    Track.track('boot_login_failed', { code: login.code });
    return false;
  }
  Session.set(login.data.token);
  // 登录成功立刻补发：游客当场升级时，这里结束时角标要已是最终状态。
  await flushPending();
  void retryPendingSave();
  void flushPendingAssist();
  void flushPendingAdEvents();
  // login 会建用户记录，云资料放在它之后拉一次，避免首次启动拿到空快照。
  void Profile.refresh();

  await loadQuality();
  return true;
}

/** 拉一次远程配置里的画质档位与资源清单；失败保持当前档，不弹错、不影响玩法。 */
async function loadQuality(): Promise<void> {
  const config = await Net.call<GetConfigData>('getConfig', { version: 0 });
  if (config.code === 0 && config.data) {
    Quality.set(config.data.configs.quality);
    // 资源清单只落内存/本地副本，不在这里下载；真正用图时由 CloudResManager 按需拉取。
    CloudResManager.setManifest(config.data.configs.resource_manifest);
  } else {
    Track.track('boot_config_failed', { code: config.code });
  }
}

/** 回大厅时再拉一次：运营把 quality 改成 low 后不必重启，下一次进厅即生效。 */
export async function refreshQuality(): Promise<void> {
  if (!Net.ready) {
    return;
  }
  await loadQuality();
}
