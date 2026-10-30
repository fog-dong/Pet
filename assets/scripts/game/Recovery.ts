// STATUS: implemented, W3 康复页（进度 + 广告加速 + 好感度结算）
import { _decorator, Button, Component, Label } from 'cc';
import { CaseSession } from './CaseSession';
import { CharacterView } from './CharacterView';
import { CharacterConfig } from '../config/CharacterConfig';
import { GameState } from '../core/GameFSM';
import { goState } from '../core/SceneFlow';
import { adButtonText } from '../cache/AdQuota';
import { adFailHint, canOfferAd, showAd } from '../net/AdGateway';
import { addButton, addLabel, addProgressBar, PALETTE, setButtonState } from '../ui/SceneUI';
import { fitWidth } from '../ui/ScreenMetrics';

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
  private shownSecond = -1;

  protected start(): void {
    const item = CaseSession.current;
    if (!item) {
      void goState(GameState.Lobby, 'Lobby');
      return;
    }
    this.seconds = CaseSession.plannedRecoverySeconds;
    this.startedAt = Date.now();
    const root = this.node;
    addLabel(root, 'PageTitle', '康 复', 470, { size: 44 });
    addLabel(root, 'PetName', `${item.petName} 正在恢复中…`, 395, {
      size: 30,
      color: PALETTE.sub,
    });
    this.redraw = addProgressBar(root, 'RecoveryBar', 45, fitWidth(720, 40), 44);
    this.redraw(0);
    this.hint = addLabel(root, 'Hint', `预计 ${this.seconds} 秒康复完成`, -35, {
      size: 24,
      color: PALETTE.sub,
    });
    // 560 宽：文案最长「看广告加速 50%（剩余 3 次）」在 30 号字下约 420，留足左右内边距不折行。
    this.speedButton = addButton(root, 'AdSpeedButton', '', -165, () => void this.speedUp(), PALETTE.accent, 560);
    this.refreshSpeed();
    addButton(root, 'AdoptButton', '进入领养', -330, () => void this.finish(), PALETTE.primary);
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
    // 立绘居中放在标题与进度条之间：贴右缘会压住 400 宽的加速按钮。
    const view = CharacterView.mount(this.node, 0, 255);
    view.node.setScale(0.62, 0.62, 1);
    view.showPet(petId, 'sick');
    this.petView = view;
    // 配置没就绪时先画兜底色块，加载完再重绘，别让进页有一段时间没有宠物。
    if (!CharacterConfig.ready) {
      void CharacterConfig.load().then(() => {
        if (this.isValid) {
          view.showPet(petId, 'sick');
        }
      });
    }
  }

  protected update(deltaTime: number): void {
    if (this.done) {
      return;
    }
    this.elapsed = Math.min(this.seconds, this.elapsed + deltaTime);
    const ratio = this.elapsed / this.seconds;
    this.redraw?.(ratio);
    this.petView?.setRecoveryProgress(ratio);
    this.updateCountdown();
    if (ratio >= 1) {
      this.complete();
    }
  }

  /** 读秒跟进度条同一个 elapsed：之前只写了静态文案，所以屏幕上的秒数一直停在 14。 */
  private updateCountdown(): void {
    const remain = Math.max(0, Math.ceil(this.seconds - this.elapsed));
    if (remain === this.shownSecond) {
      return;
    }
    this.shownSecond = remain;
    if (remain <= 0) {
      return;
    }
    this.setHint(`${this.boosted ? '加速中 · ' : ''}还需 ${remain} 秒康复完成`);
  }

  private complete(): void {
    if (this.done) {
      return;
    }
    this.done = true;
    this.petView?.playRecovered();
    this.setHint('康复完成，可以进入领养');
    // 分母用本局计划时长（正常 20s / 加速 12s）：自然走完 2 星，看广告减半 3 星。
    CaseSession.finishRecovery(Date.now() - this.startedAt, this.seconds * 1000);
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
