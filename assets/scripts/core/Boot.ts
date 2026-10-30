// STATUS: implemented, W3 启动流程（云不可用时走本地 fallback，不阻塞进厅）
// 流程：加载病例配置 → 初始化云环境 → login → getConfig → Login → Lobby
import { _decorator, Component, director } from 'cc';
import { GameState, chainAllowed, gameFSM } from './GameFSM';
import { Net } from '../net/Net';
import { CaseConfig } from '../config/CaseConfig';
import { CharacterConfig } from '../config/CharacterConfig';
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

    const [casesReady] = await Promise.all([CaseConfig.load(), CharacterConfig.load()]);
    if (!casesReady) {
      Track.track('boot_cases_missing');
    }
    Track.track('fsm_chain_check', { ok: chainAllowed() });

    if (!Net.init(CLOUD_ENV)) {
      // ENV_PLACEHOLDER：W3 不部署云函数，直接走本地模式。
      Track.track('boot_cloud_offline_fallback');
      await this.enterLobby();
      return;
    }

    const login = await Net.call<LoginData>('login', {
      version: CLIENT_VERSION,
      channel: CLIENT_CHANNEL,
    });
    if (login.code !== 0 || !login.data) {
      Track.track('boot_login_failed', { code: login.code });
      await this.enterLobby();
      return;
    }

    const config = await Net.call<GetConfigData>('getConfig', { version: 0 });
    if (config.code !== 0) {
      Track.track('boot_config_failed', { code: config.code });
    }
    await this.enterLobby();
  }

  private async enterLobby(): Promise<void> {
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
