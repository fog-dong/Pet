// STATUS: implemented, W16 P1 大厅（场景层交给 LobbyScene 挂载，次级入口交给 LobbyMenu 分派）
import { _decorator, Button, Component, Label, Node } from 'cc';
import { PrivacyState } from '../cache/PrivacyState';
import { Save } from '../cache/Save';
import { CaseConfig } from '../config/CaseConfig';
import { CharacterConfig } from '../config/CharacterConfig';
import { CONFIG_BUNDLE } from '../config/ConfigLoader';
import { COPY } from '../config/CopyText';
import { PRIVACY_GUEST_TEXT } from '../config/LegalConfig';
import { refreshQuality } from '../core/BootCloud';
import { GameState } from '../core/GameFSM';
import { Res } from '../core/Res';
import { goState } from '../core/SceneFlow';
import { CaseSession } from '../game/CaseSession';
import { CharacterView } from '../game/CharacterView';
import { Profile } from '../net/Profile';
import { Track } from '../track/Track';
import { buildLobbyMenu, HudHandle } from './LobbyChrome';
import { LobbyMenuHost, openLobbyMenu } from './LobbyMenu';
import { mountLobbyScene } from './LobbyScene';
import { LeaderboardPanel } from './LeaderboardPanel';
import { addLabel, PALETTE } from './SceneUI';
import { SyncBadge } from './SyncBadge';

const { ccclass, property } = _decorator;

const HINT_Y = -470;

@ccclass('Lobby')
export class Lobby extends Component {
  @property(Label) coinsLabel: Label | null = null;
  @property(Label) heartsLabel: Label | null = null;
  @property(Button) startButton: Button | null = null;

  private hint: Label | null = null;
  private hud: HudHandle | null = null;
  private doctorSlot: Node | null = null;
  private readonly leaderboard = new LeaderboardPanel();
  private readonly syncBadge = new SyncBadge();

  protected start(): void {
    Save.load();
    const scene = mountLobbyScene(this.node, this.startButton);
    this.doctorSlot = scene.doctorSlot;
    this.hud = scene.hud;
    buildLobbyMenu(this.node, (name) => this.onMenuClick(name));
    this.hideLegacyStats();
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
        if (this.isValid && this.doctorSlot) {
          // 名字与心情角标在大厅没有信息量（角标还会压到主按钮上），统一关掉。
          const doctor = CharacterView.mount(this.doctorSlot, 0, 40, 240);
          doctor.showDoctor('doc_director');
          doctor.hideBadges();
        }
      });
  }

  protected onDestroy(): void {
    Res.release(CONFIG_BUNDLE);
  }

  protected onEnable(): void {
    this.startButton?.node.on(Button.EventType.CLICK, this.onStartClick, this);
  }

  protected onDisable(): void {
    this.startButton?.node.off(Button.EventType.CLICK, this.onStartClick, this);
  }

  private hideLegacyStats(): void {
    if (this.coinsLabel) {
      this.coinsLabel.node.active = false;
    }
    if (this.heartsLabel) {
      this.heartsLabel.node.active = false;
    }
  }

  private onMenuClick(name: string): void {
    const host: LobbyMenuHost = {
      node: this.node,
      isValid: this.isValid,
      leaderboard: this.leaderboard,
      syncBadge: this.syncBadge,
      showHint: (text) => this.showHint(text),
      refreshStats: () => this.refreshStats(),
    };
    openLobbyMenu(name, host);
  }

  private refreshStats(): void {
    this.hud?.set(Save.coins, Save.hearts);
  }

  private onStartClick(): void {
    Track.track('lobby_start_click');
    const item = CaseConfig.random();
    if (!item) {
      Track.track('lobby_cases_missing');
      this.showHint(COPY.lobbyNoCase);
      return;
    }
    CaseSession.start(item);
    void goState(GameState.CaseIntro, 'CaseIntro');
  }

  /** 常驻提示交给玩家看的，只放一层，避免多句叠字。 */
  showHint(text: string): void {
    if (!this.hint) {
      this.hint = addLabel(this.node, 'LobbyHint', text, HINT_Y, {
        size: 24,
        color: PALETTE.sub,
        width: 620,
      });
      this.hint.node.setSiblingIndex(this.node.children.length - 1);
      return;
    }
    this.hint.string = text;
  }
}
