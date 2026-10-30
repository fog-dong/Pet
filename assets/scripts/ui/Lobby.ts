// STATUS: implemented, W9-4 大厅：展示存档并进入单局（游客模式关云端能力，可在厅内补同意）
import { _decorator, Button, Component, Label } from 'cc';
import { CaseConfig } from '../config/CaseConfig';
import { CharacterConfig } from '../config/CharacterConfig';
import { CONFIG_BUNDLE } from '../config/ConfigLoader';
import { PRIVACY_GUEST_TEXT } from '../config/LegalConfig';
import { CaseSession } from '../game/CaseSession';
import { CharacterView } from '../game/CharacterView';
import { Save } from '../cache/Save';
import { PrivacyState } from '../cache/PrivacyState';
import { GameState } from '../core/GameFSM';
import { agreePrivacy, startCloudSync } from '../core/BootCloud';
import { Res } from '../core/Res';
import { goState } from '../core/SceneFlow';
import { Codex } from './CodexPanel';
import { LeaderboardPanel } from './LeaderboardPanel';
import { openPrivacyDialog } from './PrivacyDialog';
import { Profile } from '../net/Profile';
import { addButton, addLabel, PALETTE } from '../ui/SceneUI';
import { Track } from '../track/Track';

const { ccclass, property } = _decorator;

@ccclass('Lobby')
export class Lobby extends Component {
  @property(Label)
  coinsLabel: Label | null = null;

  @property(Label)
  heartsLabel: Label | null = null;

  @property(Button)
  startButton: Button | null = null;

  private hint: Label | null = null;
  private readonly leaderboard = new LeaderboardPanel();

  protected start(): void {
    Save.load();
    this.refreshStats();
    if (PrivacyState.isGuest()) {
      // 游客：不拉云资料、不碰排行榜，本地单局照常。
      Track.track('lobby_guest_mode');
      this.showHint(PRIVACY_GUEST_TEXT);
    } else {
      void Profile.refresh();
    }
    void Track.flush();
    addButton(this.node, 'CodexButton', '图 鉴', 120, () => this.onCodexClick(), PALETTE.secondary, 260, 76, 470);
    addButton(this.node, 'LeaderboardButton', '排 行 榜', 210, () => this.onLeaderboardClick(), PALETTE.secondary, 260, 76, 470);
    addButton(this.node, 'PrivacyButton', '隐私与协议', 300, () => this.onPrivacyClick(), PALETTE.secondary, 260, 76, 470);
    void Res.loadBundle(CONFIG_BUNDLE)
      .then(() => CharacterConfig.load())
      .then(() => {
        if (!this.isValid) {
          return;
        }
        CharacterView.mount(this.node, 470, -160).showDoctor('doc_director');
      });
  }

  protected onDestroy(): void {
    Res.release(CONFIG_BUNDLE);
  }

  private onCodexClick(): void {
    Track.track('lobby_codex_click');
    if (CharacterConfig.ready) {
      Codex.open(this.node);
      return;
    }
    void CharacterConfig.load().then(() => {
      if (this.isValid) {
        Codex.open(this.node);
      }
    });
  }

  private onLeaderboardClick(): void {
    Track.track('lobby_leaderboard_click');
    if (PrivacyState.isGuest()) {
      this.showHint('游客模式下排行榜暂不可用，在「隐私与协议」中同意后即可开启。');
      return;
    }
    this.leaderboard.open(this.node);
  }

  /** 常驻入口：同意过只读正文；游客在大厅里补同意，同意后立刻接回云端能力。 */
  private onPrivacyClick(): void {
    Track.track('lobby_privacy_click');
    if (PrivacyState.accepted()) {
      openPrivacyDialog(this.node, { mode: 'read' });
      return;
    }
    openPrivacyDialog(this.node, {
      mode: 'gate',
      onAgree: (): void => {
        agreePrivacy();
        startCloudSync();
        this.showHint('已开启云端存档与排行榜。');
      },
    });
  }

  protected onEnable(): void {
    this.startButton?.node.on(Button.EventType.CLICK, this.onStartClick, this);
  }

  protected onDisable(): void {
    this.startButton?.node.off(Button.EventType.CLICK, this.onStartClick, this);
  }

  private refreshStats(): void {
    if (this.coinsLabel) {
      this.coinsLabel.string = `Coins: ${Save.coins}`;
    }
    if (this.heartsLabel) {
      this.heartsLabel.string = `Hearts: ${Save.hearts}`;
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
      this.hint = addLabel(this.node, 'LobbyHint', text, -300, {
        size: 24,
        color: PALETTE.sub,
        width: 900,
      });
      return;
    }
    this.hint.string = text;
  }
}
