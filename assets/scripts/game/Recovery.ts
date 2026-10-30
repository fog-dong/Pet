// STATUS: implemented, W3 康复页（进度 + 广告加速 + 好感度结算）
import { _decorator, Button, Component, Label } from 'cc';
import { CaseSession } from './CaseSession';
import { RECOVERY_REFERENCE_MS } from './CaseScore';
import { CharacterView } from './CharacterView';
import { CharacterConfig } from '../config/CharacterConfig';
import { GameState } from '../core/GameFSM';
import { goState } from '../core/SceneFlow';
import { adButtonText } from '../cache/AdQuota';
import { adFailHint, canOfferAd, showAd } from '../net/AdGateway';
import { addButton, addLabel, addProgressBar, PALETTE, setButtonState } from '../ui/SceneUI';
import { fitWidth, rightEdgeX } from '../ui/ScreenMetrics';

const { ccclass } = _decorator;

@ccclass('Recovery')
export class Recovery extends Component {
  private redraw: ((ratio: number) => void) | null = null;
  private petView: CharacterView | null = null;
  private hint: Label | null = null;
  private speedButton: Button | null = null;
  private seconds = 14;
  private elapsed = 0;
  private startedAt = 0;
  private done = false;
  private boosted = false;

  protected start(): void {
    const item = CaseSession.current;
    if (!item) {
      void goState(GameState.Lobby, 'Lobby');
      return;
    }
    this.seconds = CaseSession.plannedRecoverySeconds;
    this.startedAt = Date.now();
    const root = this.node;
    addLabel(root, 'PageTitle', '康 复', 300, { size: 44 });
    addLabel(root, 'PetName', `${item.petName} 正在恢复中…`, 230, {
      size: 30,
      color: PALETTE.sub,
    });
    this.redraw = addProgressBar(root, 'RecoveryBar', 120, fitWidth(720, 40), 44);
    this.redraw(0);
    this.hint = addLabel(root, 'Hint', `预计 ${this.seconds} 秒康复完成`, 50, {
      size: 24,
      color: PALETTE.sub,
    });
    // 竖屏立绘缩到 0.6 并贴右缘，给 400 宽的加速按钮留出通道。
    this.speedButton = addButton(root, 'AdSpeedButton', '', -70, () => void this.speedUp(), PALETTE.accent, 400);
    this.refreshSpeed();
    addButton(root, 'AdoptButton', '进入领养', -190, () => void this.finish(), PALETTE.primary);
    this.mountPet(item.petId);
  }

  private refreshSpeed(): void {
    if (!this.speedButton) {
      return;
    }
    if (this.boosted || this.done) {
      setButtonState(this.speedButton, false, this.boosted ? '本局已加速 50%' : '已康复完成');
      return;
    }
    setButtonState(
      this.speedButton,
      canOfferAd('accelerate'),
      adButtonText('accelerate', '看广告加速 50%'),
      PALETTE.accent,
    );
  }

  private mountPet(petId: string): void {
    void CharacterConfig.load().then(() => {
      if (!this.isValid) {
        return;
      }
      const view = CharacterView.mount(this.node, rightEdgeX(72), -30);
      view.node.setScale(0.6, 0.6, 1);
      view.showPet(petId, 'sick');
      this.petView = view;
    });
  }

  protected update(deltaTime: number): void {
    if (this.done) {
      return;
    }
    this.elapsed = Math.min(this.seconds, this.elapsed + deltaTime);
    const ratio = this.elapsed / this.seconds;
    this.redraw?.(ratio);
    this.petView?.setRecoveryProgress(ratio);
    if (ratio >= 1) {
      this.complete();
    }
  }

  private complete(): void {
    if (this.done) {
      return;
    }
    this.done = true;
    this.petView?.playRecovered();
    this.setHint('康复完成，可以进入领养');
    CaseSession.finishRecovery(Date.now() - this.startedAt, RECOVERY_REFERENCE_MS);
    this.refreshSpeed();
  }

  private async speedUp(): Promise<void> {
    if (this.done) {
      this.setHint('已经康复完成了，进入领养吧');
      return;
    }
    if (this.boosted) {
      return;
    }
    const result = await showAd('accelerate');
    if (!result.ok) {
      this.setHint(adFailHint(result, '今日加速次数已用完，可以等进度条自然走完'));
      this.refreshSpeed();
      return;
    }
    this.boosted = true;
    this.elapsed = Math.min(this.seconds, this.elapsed + this.seconds / 2);
    this.redraw?.(this.elapsed / this.seconds);
    this.setHint('已加速 50%，康复耗时减半');
    this.refreshSpeed();
    if (this.elapsed >= this.seconds) {
      this.complete();
    }
  }

  private async finish(): Promise<void> {
    if (!this.done) {
      this.setHint('还在恢复中，可以等进度条，或看广告加速');
      return;
    }
    await goState(GameState.Adoption, 'Adoption');
  }

  private setHint(text: string): void {
    if (this.hint) {
      this.hint.string = text;
    }
  }
}
