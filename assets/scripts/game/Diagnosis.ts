// STATUS: implemented, W3 诊断页（听诊小游戏 + 失败三路兜底 + 额外检查广告）
import { _decorator, Button, Component, Label, Node, UITransform } from 'cc';
import type { CaseConfigItem } from '../config/CaseConfig';
import { CaseSession } from './CaseSession';
import { Auscultation } from './Auscultation';
import type { AuscultationResult } from './AuscultationScore';
import { DiagnosisFallback } from './DiagnosisFallback';
import { GameState } from '../core/GameFSM';
import { goState } from '../core/SceneFlow';
import { AdQuota, adButtonText } from '../cache/AdQuota';
import { showAd } from '../net/AdGateway';
import { Save } from '../cache/Save';
import { Track } from '../track/Track';
import { addButton, addLabel, PALETTE, setButtonState } from '../ui/SceneUI';
import { ChoicePanel } from '../ui/ChoicePanel';

const { ccclass } = _decorator;

@ccclass('Diagnosis')
export class Diagnosis extends Component {
  private gameRoot: Node | null = null;
  private game: Auscultation | null = null;
  private hint: Label | null = null;
  private inspection: Button | null = null;
  private lastResult: AuscultationResult | null = null;
  private readonly panel = new ChoicePanel();
  private readonly fallback = new DiagnosisFallback(
    {
      root: () => this.node,
      retry: (withHint) => this.retry(withHint),
      useBattery: () => this.useBattery(),
      status: (text) => this.setHint(text),
    },
    this.panel,
  );

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
      size: 24, color: PALETTE.sub,
    });
    this.hint = addLabel(root, 'Hint', '点击宠物身上的区域，找出异常心音', -262, {
      size: 24, color: PALETTE.sub, width: 900,
    });
    const watch = (): void => void this.watchInspection();
    this.inspection = addButton(root, 'InspectionButton', '', -325, watch, PALETTE.accent, 420, 64);
    this.refreshInspection();
    this.startGame(item);
  }

  private refreshInspection(): void {
    if (!this.inspection) {
      return;
    }
    setButtonState(
      this.inspection,
      AdQuota.canShow('extra_inspection'),
      adButtonText('extra_inspection', '额外检查：再看一处'),
      PALETTE.accent,
    );
  }

  private startGame(item: CaseConfigItem): void {
    this.panel.close();
    this.gameRoot?.destroy();
    const gameRoot = new Node('AuscultationRoot');
    gameRoot.parent = this.node;
    gameRoot.setSiblingIndex(0);
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
    this.setHint('时间到了，可以重试、看广告拿线索，或用电池跳过。');
    this.fallback.open();
  }

  private async watchInspection(): Promise<void> {
    const result = await showAd('extra_inspection');
    if (!result.ok) {
      this.setHint('今日额外检查次数已用完，可以直接听诊');
      this.refreshInspection();
      return;
    }
    this.game?.revealHint();
    this.refreshInspection();
    this.setHint('额外检查点亮了一处异常');
  }

  private retry(withHint: boolean): void {
    const item = CaseSession.current;
    if (!item) {
      return;
    }
    this.panel.close();
    CaseSession.beginDiagnosis();
    CaseSession.addRetry();
    this.startGame(item);
    if (withHint) {
      this.game?.revealHint();
    }
    this.setHint(withHint ? '已点亮一处异常，慢慢来' : '已重置听诊，重新开始');
  }

  private useBattery(): void {
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

  private setHint(text: string): void {
    if (this.hint) {
      this.hint.string = text;
    }
  }

  protected onDestroy(): void {
    this.panel.close();
  }
}
