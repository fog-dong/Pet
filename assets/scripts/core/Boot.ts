// STATUS: implemented, W6 启动流程（云不可用时走本地 fallback，不阻塞进厅；登录后补发队列）
// 流程：加载病例配置 → 初始化云环境 → login → getConfig → 补发待同步 → Login → Lobby
import { _decorator, Component, director, Node } from 'cc';
import { DEBUG } from 'cc/env';
import { GameState, chainAllowed, gameFSM } from './GameFSM';
import { Res } from './Res';
import { Net } from '../net/Net';
import { Session } from '../net/Session';
import { flushPending } from '../net/SyncCaseResult';
import { retryPendingSave } from '../net/CloudSave';
import { CaseConfig } from '../config/CaseConfig';
import { CharacterConfig } from '../config/CharacterConfig';
import { CONFIG_BUNDLE } from '../config/ConfigLoader';
import { Quality } from '../config/Quality';
import { CLOUD_ENV, CLIENT_CHANNEL, CLIENT_VERSION } from '../config/EnvConfig';
import { DebugPanel } from '../ui/DebugPanel';
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
    this.mountDebugPanel();
    void this.bootstrap();
  }

  /** 只在 DEBUG 构建挂载性能面板；release 构建整段不执行。 */
  private mountDebugPanel(): void {
    if (!DEBUG) {
      return;
    }
    const node = new Node('DebugPanel');
    director.getScene()?.addChild(node);
    director.addPersistRootNode(node);
    node.addComponent(DebugPanel);
  }

  private async bootstrap(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;

    const casesBundle = await Res.loadBundle(CONFIG_BUNDLE);
    if (!casesBundle) {
      Track.track('boot_cases_bundle_missing');
    }
    const [casesReady] = await Promise.all([CaseConfig.load(), CharacterConfig.load()]);
    if (!casesReady) {
      Track.track('boot_cases_missing');
    }
    // 配置已缓存进内存，释放 Boot 持有的分包引用，交给大厅按页引用。
    Res.release(CONFIG_BUNDLE);
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
    if (config.code === 0 && config.data) {
      Quality.set(config.data.configs.quality);
    } else {
      Track.track('boot_config_failed', { code: config.code });
    }
    Session.set(login.data.token);
    void flushPending();
    void retryPendingSave();
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
