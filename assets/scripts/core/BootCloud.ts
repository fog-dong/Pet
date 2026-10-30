// STATUS: implemented, W7 启动后台云同步（登录/配置/队列补发，不阻塞进厅）
import { Net } from '../net/Net';
import { Session } from '../net/Session';
import { flushPending } from '../net/SyncCaseResult';
import { retryPendingSave } from '../net/CloudSave';
import { flushPendingAssist } from '../net/AssistSync';
import { flushPendingAdEvents } from '../net/AdEvent';
import { Profile } from '../net/Profile';
import { Quality } from '../config/Quality';
import { CLIENT_CHANNEL, CLIENT_VERSION } from '../config/EnvConfig';
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

/**
 * 进入大厅后再跑：登录拿 token → 补发离线队列 → 拉云资料 → 拉远端配置。
 * 全程不 await 场景加载，网络慢时玩家仍能进大厅看本地内容。
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
