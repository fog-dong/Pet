// STATUS: implemented, W8-5 启动流程（首帧后先要隐私同意，再拉配置与云端同步，同意后才进厅）
import { _decorator, Component, profiler } from 'cc';
import { DEBUG } from 'cc/env';
import { GameState, chainAllowed, gameFSM } from './GameFSM';
import { goState } from './SceneFlow';
import { Res } from './Res';
import { Net } from '../net/Net';
import { WxPrivacy } from '../net/Privacy';
import { syncCloud } from './BootCloud';
import { PrivacyState } from '../cache/PrivacyState';
import { CaseConfig } from '../config/CaseConfig';
import { CharacterConfig } from '../config/CharacterConfig';
import { CONFIG_BUNDLE } from '../config/ConfigLoader';
import { BUNDLE_TIMEOUT_MS } from '../config/BundleConfig';
import { CLOUD_ENV } from '../config/EnvConfig';
import { LEGAL_VERSION } from '../config/LegalConfig';
import { openPrivacyDialog } from '../ui/PrivacyDialog';
import { addLabel, PALETTE } from '../ui/SceneUI';
import { Track } from '../track/Track';

const { ccclass } = _decorator;
const LOBBY_SCENE = 'Lobby';

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
    WxPrivacy.register();
    addLabel(this.node, 'BootLoading', '正在准备诊疗室…', 0, { size: 32, color: PALETTE.panel });
    // 调试浮层只用引擎自带 profiler：脚本层不留自定义面板，避免未使用的类被打进发布包。
    if (DEBUG) {
      profiler.showStats();
    }
    void this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;

    const loading = Res.loadBundle(CONFIG_BUNDLE);
    const bundle = await withTimeout(loading, BUNDLE_TIMEOUT_MS);
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

    // 隐私同意发生在任何云端调用之前：未同意时不发登录请求，也不进大厅。
    if (!(await this.gatePrivacy())) {
      Track.track('boot_privacy_pending');
      return;
    }

    if (Net.init(CLOUD_ENV)) {
      void syncCloud();
    } else {
      // ENV_PLACEHOLDER：未部署云函数时走本地模式，不阻塞单局。
      Track.track('boot_cloud_offline_fallback');
    }
    await this.enterLobby();
  }

  /** 首帧后弹隐私窗；已同意且版本一致则直接放行。 */
  private gatePrivacy(): Promise<boolean> {
    if (PrivacyState.accepted()) {
      return Promise.resolve(true);
    }
    Track.track('privacy_dialog_show', { version: LEGAL_VERSION });
    return new Promise<boolean>((resolve) => {
      openPrivacyDialog(this.node, {
        mode: 'gate',
        onAgree: (): void => {
          PrivacyState.markAccepted();
          Track.track('privacy_agree', { version: LEGAL_VERSION });
          void WxPrivacy.request();
          resolve(true);
        },
      });
    });
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
