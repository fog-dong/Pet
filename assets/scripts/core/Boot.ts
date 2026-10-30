// STATUS: implemented, W11-2 启动流程（合规两行走安全区贴底、常驻 ≥3s；隐私门在云端初始化之前，不同意走游客模式）
import { _decorator, Component, profiler } from 'cc';
import { DEBUG } from 'cc/env';
import { GameState, chainAllowed, gameFSM } from './GameFSM';
import { goState } from './SceneFlow';
import { Res } from './Res';
import { agreePrivacy, startCloudSync } from './BootCloud';
import { PrivacyState } from '../cache/PrivacyState';
import { WxPrivacy } from '../net/Privacy';
import { CaseConfig } from '../config/CaseConfig';
import { CharacterConfig } from '../config/CharacterConfig';
import { CONFIG_BUNDLE } from '../config/ConfigLoader';
import { BUNDLE_TIMEOUT_MS } from '../config/BundleConfig';
import { AGE_RATING_TEXT, GAME_NAME, HEALTH_GAME_NOTICE_TEXT, LEGAL_VERSION, legalUrlsReady } from '../config/LegalConfig';
import { openPrivacyDialog } from '../ui/PrivacyDialog';
import { addLabel, createNode, PALETTE } from '../ui/SceneUI';
import { alignBottom, alignTop, attachSafeArea } from '../ui/SafeLayout';
import { paintSceneBackground } from '../ui/ScreenTheme';
import { fitWidth, screenHeight, screenWidth } from '../ui/ScreenMetrics';
import { Track } from '../track/Track';

const { ccclass } = _decorator;
const LOBBY_SCENE = 'Lobby';

/** 合规两行距安全区底边：忠告 48、适龄 88；两行都必须常驻 ≥ SPLASH_MIN_MS 才允许进大厅。 */
const SPLASH_MIN_MS = 3000;
const SPLASH_NAME_TOP = 48;
// 忠告全文在 720 宽下折成两行，底部对齐后节点会向上长高，适龄行必须再抬高一行。
const LEGAL_NOTICE_BOTTOM = 40;
const LEGAL_AGE_BOTTOM = 132;

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
  private readonly splashAt = Date.now();

  protected start(): void {
    paintSceneBackground();
    Track.start();
    WxPrivacy.register();
    addLabel(this.node, 'BootLoading', '正在准备救助站…', 0, { size: 32, color: PALETTE.text });
    this.addSplashLegal();
    // 调试浮层只用引擎自带 profiler：脚本层不留自定义面板，避免未使用的类被打进发布包。
    if (DEBUG) { profiler.showStats(); }
    void this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    if (this.started) { return; }
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

    // 隐私门在任何云端调用之前：同意才初始化云端，选游客模式则全程不碰云端。
    const consent = await this.gatePrivacy();
    if (consent === 'granted') {
      startCloudSync();
    }
    // 云端是否就绪都不影响这里：只保证底部合规文案在启动页至少驻留 3 秒。
    await this.waitSplash();
    await this.enterLobby();
  }

  /** 合成三要素：名称贴顶、忠告与适龄贴底，截图首图必须同屏。 */
  private addSplashLegal(): void {
    const root = createNode(this.node.parent ?? this.node, 'BootSplashLegal', 0, screenWidth(), screenHeight());
    attachSafeArea(root);
    const name = addLabel(root, 'BootSplashName', GAME_NAME, 0, { size: 44, color: PALETTE.text, width: fitWidth(1100, 90) });
    alignTop(name.node, SPLASH_NAME_TOP);
    const notice = addLabel(root, 'BootSplashNotice', HEALTH_GAME_NOTICE_TEXT, 0, { size: 18, color: PALETTE.sub, width: fitWidth(1100, 90) });
    alignBottom(notice.node, LEGAL_NOTICE_BOTTOM);
    const age = addLabel(root, 'BootSplashAge', AGE_RATING_TEXT, 0, { size: 22, color: PALETTE.sub, width: fitWidth(1100, 90) });
    alignBottom(age.node, LEGAL_AGE_BOTTOM);
  }

  /** 启动页驻留：玩家在协议页读得久了不再叠加等待，只补足 3 秒的缺口。 */
  private waitSplash(): Promise<void> {
    const remain = SPLASH_MIN_MS - (Date.now() - this.splashAt);
    return remain <= 0 ? Promise.resolve() : new Promise<void>((resolve) => setTimeout(resolve, remain));
  }

  /** 启动 loading 期间弹隐私窗；已同意放行；游客期不主动重弹，升级入口留在大厅与关于面板。 */
  private gatePrivacy(): Promise<'granted' | 'guest'> {
    if (PrivacyState.accepted()) {
      return Promise.resolve('granted');
    }
    if (PrivacyState.isGuest()) {
      Track.track('privacy_guest_resume', { version: LEGAL_VERSION });
      return Promise.resolve('guest');
    }
    Track.track('privacy_dialog_show', { version: LEGAL_VERSION });
    return new Promise<'granted' | 'guest'>((resolve) => {
      openPrivacyDialog(this.node, {
        mode: 'gate',
        onAgree: (): void => {
          agreePrivacy();
          resolve('granted');
        },
        onGuest: (): void => {
          PrivacyState.markGuest();
          Track.track('privacy_guest_mode', { version: LEGAL_VERSION });
          resolve('guest');
        },
      });
    });
  }

  private async enterLobby(): Promise<void> {
    // 隐私门之后、进大厅之前做一次协议 URL 自检：占位只记日志，不阻塞发布。
    if (!legalUrlsReady()) {
      Track.track('boot_legal_urls_placeholder');
      if (DEBUG) { console.warn('[Legal] 协议 URL 仍为占位，提审前替换 LegalConfig.LEGAL_DOCS'); }
    }
    if (!(await gameFSM.transition(GameState.Login))) {
      Track.track('boot_fsm_blocked', { state: gameFSM.state });
      return;
    }
    if (!(await goState(GameState.Lobby, LOBBY_SCENE))) {
      Track.track('boot_lobby_scene_missing');
    }
  }
}
