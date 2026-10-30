// STATUS: implemented, W7 启动流程（本地配置 + 2.5s 分包预算后进厅，云端同步后台跑）
import { _decorator, Component, director, Node } from 'cc';
import { DEBUG } from 'cc/env';
import { GameState, chainAllowed, gameFSM } from './GameFSM';
import { goState } from './SceneFlow';
import { Res } from './Res';
import { Net } from '../net/Net';
import { syncCloud } from './BootCloud';
import { CaseConfig } from '../config/CaseConfig';
import { CharacterConfig } from '../config/CharacterConfig';
import { CONFIG_BUNDLE } from '../config/ConfigLoader';
import { CLOUD_ENV } from '../config/EnvConfig';
import { DebugPanel } from '../ui/DebugPanel';
import { addLabel, PALETTE } from '../ui/SceneUI';
import { Track } from '../track/Track';

const { ccclass } = _decorator;
const LOBBY_SCENE = 'Lobby';
const BUNDLE_BUDGET_MS = 2500;

/** 分包加载最多等这么久，超时就用内置病例兜底，避免低端机首屏黑屏。 */
function withTimeout<T>(task: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    const settle = (value: T | null): void => {
      clearTimeout(timer);
      resolve(value);
    };
    task.then(settle, () => settle(null));
  });
}

@ccclass('Boot')
export class Boot extends Component {
  private started = false;

  protected start(): void {
    Track.start();
    addLabel(this.node, 'BootLoading', '正在准备诊疗室…', 0, { size: 32, color: PALETTE.panel });
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

    const loading = Res.loadBundle(CONFIG_BUNDLE);
    const bundle = await withTimeout(loading, BUNDLE_BUDGET_MS);
    if (bundle === null) {
      Track.track('boot_cases_bundle_slow');
      // 超时后分包才到：释放这次引用，交给下次场景切换回收。
      void loading.then(() => Res.release(CONFIG_BUNDLE), () => undefined);
    } else if (!bundle) {
      Track.track('boot_cases_bundle_missing');
    }
    const [casesReady] = await Promise.all([CaseConfig.load(), CharacterConfig.load()]);
    if (!casesReady) {
      Track.track('boot_cases_missing');
    }
    // 配置已缓存进内存，释放 Boot 持有的分包引用，交给大厅按页引用。
    Res.release(CONFIG_BUNDLE);
    Track.track('fsm_chain_check', { ok: chainAllowed() });

    if (Net.init(CLOUD_ENV)) {
      void syncCloud();
    } else {
      // ENV_PLACEHOLDER：未部署云函数时走本地模式，不阻塞单局。
      Track.track('boot_cloud_offline_fallback');
    }
    await this.enterLobby();
  }

  private async enterLobby(): Promise<void> {
    if (!(await gameFSM.transition(GameState.Login))) {
      Track.track('boot_fsm_blocked', { state: gameFSM.state });
      return;
    }
    if (!(await goState(GameState.Lobby, LOBBY_SCENE))) {
      Track.track('boot_lobby_scene_missing');
    }
  }
}
