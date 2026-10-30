// STATUS: implemented, W3 诊断页（听诊小游戏 + 失败三路兜底）
import { _decorator, Component, Label, Node, UITransform } from 'cc';
import type { CaseConfigItem } from '../config/CaseConfig';
import { CaseSession } from './CaseSession';
import { Auscultation } from './Auscultation';
import type { AuscultationResult } from './AuscultationScore';
import { GameState } from '../core/GameFSM';
import { goState } from '../core/SceneFlow';
import { Ad } from '../net/Ad';
import { Save } from '../cache/Save';
import { Track } from '../track/Track';
import { addButton, addLabel, addRect, PALETTE } from '../ui/SceneUI';

const { ccclass } = _decorator;

@ccclass('Diagnosis')
export class Diagnosis extends Component {
  private gameRoot: Node | null = null;
  private game: Auscultation | null = null;
  private panel: Node | null = null;
  private hint: Label | null = null;
  private lastResult: AuscultationResult | null = null;

  protected start(): void {
    const item = CaseSession.current;
    if (!item) {
      void goState(GameState.Lobby, 'Lobby');
      return;
    }
    CaseSession.beginDiagnosis();
    const root = this.node;
    addLabel(root, 'PageTitle', '听 诊', 330, { size: 40 });
    addLabel(root, 'PetName', `${item.petName} · ${item.breed}`, 288, {
      size: 24,
      color: PALETTE.sub,
    });
    this.hint = addLabel(root, 'Hint', '点击宠物身上的区域，找出异常心音', -280, {
      size: 24,
      color: PALETTE.sub,
      width: 900,
    });
    this.startGame(item);
  }

  private startGame(item: CaseConfigItem): void {
    this.closePanel();
    this.gameRoot?.destroy();
    const gameRoot = new Node('AuscultationRoot');
    gameRoot.parent = this.node;
    gameRoot.addComponent(UITransform).setContentSize(1280, 720);
    this.gameRoot = gameRoot;
    const game = gameRoot.addComponent(Auscultation);
    this.game = game;
    game.startWith(item, (result) => this.onFinished(result));
  }

  private onFinished(result: AuscultationResult): void {
    this.lastResult = result;
    CaseSession.finishDiagnosis(result.stars, result.mistakes, result.timeUsedMs);
    if (result.stars > 0) {
      this.setHint('诊断明确，准备治疗。');
      void goState(GameState.Treatment, 'Treatment');
      return;
    }
    this.setHint('时间到了，可以重试，或看广告获得一条线索。');
    this.showFailurePanel();
  }

  private showFailurePanel(): void {
    if (this.panel) {
      return;
    }
    const panel = addRect(this.node, 'FailPanel', 0, 900, 420, PALETTE.panel);
    this.panel = panel;
    addLabel(panel, 'FailTitle', '这次没听清，选一条路继续', 150, { size: 32, width: 820 });
    addButton(panel, 'RetryButton', '免费重试', 40, () => this.retry(false), PALETTE.secondary, 420);
    addButton(panel, 'AdButton', '看广告获得线索（占位）', -60, () => void this.watchAd(), PALETTE.accent, 460);
    addButton(panel, 'ItemButton', '用听诊器电池跳过', -160, () => this.useItem(), PALETTE.primary, 460);
  }

  private retry(withHint: boolean): void {
    const item = CaseSession.current;
    if (!item) {
      return;
    }
    this.closePanel();
    CaseSession.beginDiagnosis();
    CaseSession.addRetry();
    this.startGame(item);
    if (withHint) {
      this.game?.revealHint();
    }
    this.setHint(withHint ? '已点亮一处异常，慢慢来' : '已重置听诊，重新开始');
  }

  private useItem(): void {
    if (!Save.useItem('battery')) {
      this.setHint('听诊器电池不足，可直接免费重试');
      return;
    }
    const item = CaseSession.current;
    const result = this.lastResult;
    Track.track('diagnosis_item_skip', { caseId: item ? item.caseId : '' });
    CaseSession.finishDiagnosis(1, result ? result.mistakes : 0, result ? result.timeUsedMs : 0);
    void goState(GameState.Treatment, 'Treatment');
  }

  private async watchAd(): Promise<void> {
    const result = await Ad.showRewarded('extra_check');
    if (!result.ok) {
      this.setHint('广告未就绪（W2 占位），可直接免费重试');
      return;
    }
    this.retry(true);
  }

  private setHint(text: string): void {
    if (this.hint) {
      this.hint.string = text;
    }
  }

  private closePanel(): void {
    if (this.panel) {
      this.panel.destroy();
      this.panel = null;
    }
  }
}
