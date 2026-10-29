// STATUS: scaffold, API frozen by architect on 2026-10-29
// 大厅页：只做展示与入口，不持有业务数据、不发网络请求。
import { _decorator, Button, Component, Label } from 'cc';
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

  protected onEnable(): void {
    this.startButton?.node.on(Button.EventType.CLICK, this.onStartClick, this);
  }

  protected onDisable(): void {
    this.startButton?.node.off(Button.EventType.CLICK, this.onStartClick, this);
  }

  private onStartClick(): void {
    Track.track('lobby_start_click');
  }
}
