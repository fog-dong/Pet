// STATUS: implemented, W3 康复页（进度条 + 广告加速占位）
import { _decorator, Component, Label } from 'cc';
import { CaseSession } from './CaseSession';
import { CharacterView } from './CharacterView';
import { CharacterConfig } from '../config/CharacterConfig';
import { GameState } from '../core/GameFSM';
import { goState } from '../core/SceneFlow';
import { Ad } from '../net/Ad';
import { addButton, addLabel, addProgressBar, PALETTE } from '../ui/SceneUI';

const { ccclass } = _decorator;
const BASE_SECONDS = 10;

@ccclass('Recovery')
export class Recovery extends Component {
  private redraw: ((ratio: number) => void) | null = null;
  private petView: CharacterView | null = null;
  private hint: Label | null = null;
  private seconds = BASE_SECONDS;
  private elapsed = 0;
  private done = false;

  protected start(): void {
    const item = CaseSession.current;
    if (!item) {
      void goState(GameState.Lobby, 'Lobby');
      return;
    }
    const root = this.node;
    addLabel(root, 'PageTitle', '康 复', 280, { size: 46 });
    addLabel(root, 'PetName', `${item.petName} 正在恢复中…`, 200, { size: 30, color: PALETTE.sub });
    this.redraw = addProgressBar(root, 'RecoveryBar', 90, 720, 44);
    this.redraw(0);
    this.hint = addLabel(root, 'Hint', `预计 ${BASE_SECONDS} 秒康复完成`, 20, {
      size: 24,
      color: PALETTE.sub,
    });
    addButton(root, 'AdSpeedButton', '看广告加速 50%（占位）', -90, () => void this.speedUp(), PALETTE.accent, 460);
    addButton(root, 'AdoptButton', '进入领养', -200, () => void this.finish(), PALETTE.primary);
    addButton(
      root,
      'SkipButton',
      '跳过等待',
      -300,
      () => {
        this.elapsed = this.seconds;
        void this.finish();
      },
      PALETTE.secondary,
    );
    this.mountPet(item.petId);
  }

  private mountPet(petId: string): void {
    void CharacterConfig.load().then(() => {
      if (!this.isValid) {
        return;
      }
      const view = CharacterView.mount(this.node, 470, -30);
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
    if (this.elapsed >= this.seconds) {
      this.done = true;
      this.petView?.playRecovered();
      if (this.hint) {
        this.hint.string = '康复完成，可以进入领养';
      }
    }
  }

  private async speedUp(): Promise<void> {
    const result = await Ad.showRewarded('recovery_speed');
    if (!result.ok) {
      if (this.hint) {
        this.hint.string = '广告未就绪（W2 占位），可等进度条或直接跳过';
      }
      return;
    }
    this.elapsed = Math.min(this.seconds, this.elapsed + this.seconds / 2);
    this.redraw?.(this.elapsed / this.seconds);
  }

  private async finish(): Promise<void> {
    this.done = true;
    await goState(GameState.Adoption, 'Adoption');
  }
}
