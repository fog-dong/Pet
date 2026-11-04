// STATUS: implemented, W25 P2-A2 危重倒计时红条（治疗页挂载，同时是时钟驱动者与切后台暂停点）
import { _decorator, Color, Component, game, Game, Label, Node, tween, Tween, Vec3 } from 'cc';
import { COPY, fillCopy } from '../config/CopyText';
import { PenaltyConfig } from '../config/PenaltyConfig';
import { CaseCrisis } from '../game/CaseCrisis';
import { runCrisisTransfer } from '../game/CrisisTransfer';
import { addLabel } from './SceneUI';
import { addPill, createBox, paintRound } from './PanelKit';
import { fitWidth } from './ScreenMetrics';
import { DURATION, COLORS } from './Tokens';

const { ccclass } = _decorator;

const BAR_W = 560;
const BAR_H = 48;
const BEAT = new Vec3(1.04, 1.04, 1);
const SETTLED = new Vec3(1, 1, 1);
const FILL = new Color(201, 74, 62, 255);
const TRACK = new Color(62, 50, 42, 214);

/** 红条水线：治疗页库存说明（384）与首行上沿（246+42）之间。 */
const CRISIS_HUD_Y = 328;

@ccclass('CrisisHud')
export class CrisisHud extends Component {
  private root: Node | null = null;
  private fill: Node | null = null;
  private label: Label | null = null;
  private beating = false;
  private fired = false;
  private lastRatio = -1;
  private barWidth = BAR_W - 14;

  protected start(): void {
    const width = fitWidth(BAR_W, 80);
    this.barWidth = Math.max(1, width - 14);
    this.root = createBox(this.node, 'CrisisHud', CRISIS_HUD_Y, width, BAR_H);
    addPill(this.root, 'CrisisTrack', 0, width, BAR_H, TRACK);
    this.fill = createBox(this.root, 'CrisisFill', 0, this.barWidth, BAR_H - 14);
    paintRound(this.fill, this.barWidth, BAR_H - 14, (BAR_H - 14) / 2, FILL);
    this.label = addLabel(this.root, 'CrisisLabel', '', 0, {
      size: 22,
      color: COLORS.white,
      width: width - 32,
    });
    this.root.active = false;
  }

  protected onEnable(): void {
    game.on(Game.EVENT_HIDE, this.onHide, this);
    game.on(Game.EVENT_SHOW, this.onShow, this);
  }

  protected onDisable(): void {
    game.off(Game.EVENT_HIDE, this.onHide, this);
    game.off(Game.EVENT_SHOW, this.onShow, this);
    this.setBeat(false);
  }

  protected update(): void {
    const view = CaseCrisis.view();
    const visible = view.status !== 'idle';
    if (this.root && this.root.active !== visible) {
      this.root.active = visible;
    }
    this.setBeat(view.status === 'running');
    if (!visible || !this.root) {
      return;
    }
    this.paintRatio(view.ratio);
    if (this.label) {
      this.label.string = view.status === 'paused'
        ? COPY.crisisPaused
        : fillCopy(COPY.crisisRunning, { seconds: view.seconds });
    }
    if (view.status === 'expired' && !this.fired) {
      this.fired = true;
      runCrisisTransfer();
    }
  }

  private paintRatio(ratio: number): void {
    if (!this.fill || Math.abs(ratio - this.lastRatio) < 0.001) {
      return;
    }
    this.lastRatio = ratio;
    // 左端固定：缩放同时把中心按 (1-ratio) 往左挪，红条只从右往左收，不会两头对称地缩。
    this.fill.setScale(Math.max(0.02, ratio), 1, 1);
    this.fill.setPosition((this.barWidth * (ratio - 1)) / 2, 0, 0);
  }

  private setBeat(on: boolean): void {
    if (this.beating === on || !this.root) {
      return;
    }
    this.beating = on;
    Tween.stopAllByTarget(this.root);
    this.root.setScale(SETTLED);
    if (!on) {
      return;
    }
    tween(this.root)
      .to(DURATION.crisisBeat, { scale: BEAT }, { easing: 'sineInOut' })
      .to(DURATION.crisisBeat, { scale: SETTLED }, { easing: 'sineInOut' })
      .repeatForever()
      .start();
  }

  private onHide(): void {
    if (PenaltyConfig.crisis.pauseOnHide) {
      CaseCrisis.pause();
    }
  }

  private onShow(): void {
    if (PenaltyConfig.crisis.pauseOnHide) {
      CaseCrisis.resume();
    }
  }
}
