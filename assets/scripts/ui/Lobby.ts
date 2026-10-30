// STATUS: implemented, W3 大厅：展示存档并进入单局
import { _decorator, Button, Component, Label } from 'cc';
import { CaseConfig } from '../config/CaseConfig';
import { CaseSession } from '../game/CaseSession';
import { Save } from '../cache/Save';
import { GameState } from '../core/GameFSM';
import { goState } from '../core/SceneFlow';
import { addLabel, PALETTE } from '../ui/SceneUI';
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

  protected start(): void {
    Save.load();
    this.refreshStats();
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
      this.showHint('病例配置未加载，检查 assets/resources/config/cases.json');
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
