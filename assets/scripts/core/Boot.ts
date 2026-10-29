// STATUS: scaffold, API frozen by architect on 2026-10-29
// 启动流程：初始化云环境 → login → getConfig → Login → Lobby（09 §3、08 §3）
import { _decorator, Component, director } from 'cc';
import { GameState, gameFSM } from './GameFSM';
import { Net } from '../net/Net';
import { CLOUD_ENV, CLIENT_CHANNEL, CLIENT_VERSION } from '../config/EnvConfig';
import { Track } from '../track/Track';

const { ccclass } = _decorator;
const LOBBY_SCENE = 'Lobby';

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

@ccclass('Boot')
export class Boot extends Component {
  private started = false;

  protected start(): void {
    void this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;

    if (!Net.init(CLOUD_ENV)) {
      Track.track('boot_cloud_env_placeholder');
      return;
    }

    const login = await Net.call<LoginData>('login', {
      version: CLIENT_VERSION,
      channel: CLIENT_CHANNEL,
    });
    if (login.code !== 0 || !login.data) {
      Track.track('boot_login_failed', { code: login.code });
      return;
    }

    // 配置拉取失败不阻塞进入大厅，沿用本地兜底。
    const config = await Net.call<GetConfigData>('getConfig', { version: 0 });
    if (config.code !== 0) {
      Track.track('boot_config_failed', { code: config.code });
    }

    if (!(await gameFSM.transition(GameState.Login))) {
      Track.track('boot_fsm_blocked', { state: gameFSM.state });
      return;
    }
    if (!(await gameFSM.transition(GameState.Lobby))) {
      Track.track('boot_fsm_blocked', { state: gameFSM.state });
      return;
    }

    if (!director.loadScene(LOBBY_SCENE)) {
      Track.track('boot_lobby_scene_missing');
    }
  }
}
