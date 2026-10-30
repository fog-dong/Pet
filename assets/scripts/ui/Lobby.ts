// STATUS: implemented, W16-1 大厅中轴布局 + 中文资源位（原右侧贴边按钮列与英文 Coins/Hearts 未过审视图检）
import { _decorator, Button, Component, Label } from 'cc';
import { CaseConfig } from '../config/CaseConfig';
import { CharacterConfig } from '../config/CharacterConfig';
import { CONFIG_BUNDLE } from '../config/ConfigLoader';
import { GAME_NAME, PRIVACY_GUEST_TEXT } from '../config/LegalConfig';
import { CaseSession } from '../game/CaseSession';
import { CharacterView } from '../game/CharacterView';
import { Save } from '../cache/Save';
import { PrivacyState } from '../cache/PrivacyState';
import { GameState } from '../core/GameFSM';
import { Res } from '../core/Res';
import { goState } from '../core/SceneFlow';
import { Codex } from './CodexPanel';
import { LeaderboardPanel } from './LeaderboardPanel';
import { openAboutPanel } from './AboutPanel';
import { openPrivacyEntry } from './PrivacyDialog';
import { buildLobbyMenu, styleStartButton } from './LobbyChrome';
import { Profile } from '../net/Profile';
import { refreshQuality } from '../core/BootCloud';
import { addLabel, PALETTE } from '../ui/SceneUI';
import { pinTopLeft } from '../ui/SafeLayout';
import { SyncBadge } from './SyncBadge';
import { Track } from '../track/Track';

const { ccclass, property } = _decorator;

const TITLE_Y = 470;
const START_Y = 300;
const HINT_Y = -470;
const MENU_TRACK: Record<string, string> = {
  CodexButton: 'lobby_codex_click',
  LeaderboardButton: 'lobby_leaderboard_click',
  PrivacyButton: 'lobby_privacy_click',
  AboutButton: 'lobby_about_click',
};

@ccclass('Lobby')
export class Lobby extends Component {
  @property(Label) coinsLabel: Label | null = null;
  @property(Label) heartsLabel: Label | null = null;
  @property(Button) startButton: Button | null = null;

  private hint: Label | null = null;
  private readonly leaderboard = new LeaderboardPanel();
  private readonly syncBadge = new SyncBadge();

  protected start(): void {
    Save.load();
    // 场景里的两枚资源标签仍是 1280 时代的绝对坐标（x=-440），竖屏下改挂 Widget 贴左上角。
    pinTopLeft([this.coinsLabel?.node ?? null, this.heartsLabel?.node ?? null], 24, 24);
    addLabel(this.node, 'LobbyTitle', GAME_NAME, TITLE_Y, { size: 44, color: PALETTE.text });
    if (this.startButton) { styleStartButton(this.startButton, 0, START_Y, '开始接诊'); }
    buildLobbyMenu(this.node, (name) => this.onMenuClick(name));
    this.refreshStats();
    if (PrivacyState.isGuest()) {
      // 游客：不拉云资料、不碰排行榜，本地单局照常。
      Track.track('lobby_guest_mode');
      this.showHint(PRIVACY_GUEST_TEXT);
    } else {
      void Profile.refresh();
      void refreshQuality();
      // 进厅补发一次待同步结算（配置晚发布时金币延迟到账，这里给玩家一个可见提示）。
      this.syncBadge.mount(this.node);
      void this.syncBadge.drain();
    }
    void Track.flush();
    void Res.loadBundle(CONFIG_BUNDLE)
      .then(() => CharacterConfig.load())
      .then(() => {
        if (this.isValid) {
          CharacterView.mount(this.node, 0, 90).showDoctor('doc_director');
        }
      });
  }

  protected onDestroy(): void {
    Res.release(CONFIG_BUNDLE);
  }

  private onMenuClick(name: string): void {
    Track.track(MENU_TRACK[name] ?? 'lobby_menu_click');
    if (name === 'CodexButton') {
      void CharacterConfig.load().then(() => {
        if (this.isValid && CharacterConfig.ready) {
          Codex.open(this.node);
        }
      });
      return;
    }
    if (name === 'LeaderboardButton') {
      if (PrivacyState.isGuest()) {
        this.showHint('游客模式下排行榜暂不可用，在「隐私与协议」中同意后即可开启。');
        return;
      }
      this.leaderboard.open(this.node);
      return;
    }
    // 常驻入口：同意过只读正文；游客在此补同意，登录成功后当场补发本地结算。
    if (name === 'PrivacyButton') {
      openPrivacyEntry(this.node, (cloud) => {
        this.syncBadge.finishUpgrade(this.node, cloud, (text) => this.showHint(text));
      });
      return;
    }
    openAboutPanel(this.node);
  }

  protected onEnable(): void {
    this.startButton?.node.on(Button.EventType.CLICK, this.onStartClick, this);
  }

  protected onDisable(): void {
    this.startButton?.node.off(Button.EventType.CLICK, this.onStartClick, this);
  }

  private refreshStats(): void {
    if (this.coinsLabel) {
      this.coinsLabel.string = `金币 ${Save.coins}`;
      this.coinsLabel.color = PALETTE.text;
    }
    if (this.heartsLabel) {
      this.heartsLabel.string = `爱心 ${Save.hearts}`;
      this.heartsLabel.color = PALETTE.text;
    }
  }

  private onStartClick(): void {
    Track.track('lobby_start_click');
    const item = CaseConfig.random();
    if (!item) {
      this.showHint('病例配置未加载，检查 assets/bundles/cases/config/cases.json');
      return;
    }
    CaseSession.start(item);
    void goState(GameState.CaseIntro, 'CaseIntro');
  }

  private showHint(text: string): void {
    if (!this.hint) {
      this.hint = addLabel(this.node, 'LobbyHint', text, HINT_Y, {
        size: 24,
        color: PALETTE.sub,
        width: 620,
      });
      return;
    }
    this.hint.string = text;
  }
}
