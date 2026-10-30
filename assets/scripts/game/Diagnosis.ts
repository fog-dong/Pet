// STATUS: implemented, W3 诊断页（占位：一个完成按钮 + 失败三路兜底）
import { _decorator, Component, Label, Node } from 'cc';
import { CaseSession } from './CaseSession';
import { CharacterView } from './CharacterView';
import { CharacterConfig } from '../config/CharacterConfig';
import { GameState } from '../core/GameFSM';
import { goState } from '../core/SceneFlow';
import { Ad } from '../net/Ad';
import { Save } from '../cache/Save';
import { Track } from '../track/Track';
import { addButton, addLabel, addRect, PALETTE } from '../ui/SceneUI';

const { ccclass } = _decorator;
const ITEM_SKIP_COST = 50;

@ccclass('Diagnosis')
export class Diagnosis extends Component {
  private hint: Label | null = null;
  private panel: Node | null = null;

  protected start(): void {
    const item = CaseSession.current;
    if (!item) {
      void goState(GameState.Lobby, 'Lobby');
      return;
    }
    CaseSession.beginDiagnosis();

    const root = this.node;
    addLabel(root, 'PageTitle', '诊 断（占位）', 280, { size: 46 });
    addLabel(root, 'PetName', `${item.petName} · ${item.breed}`, 195, { size: 32 });
    addLabel(root, 'Symptom', `症状：${item.symptoms.join(' · ')}`, 140, {
      size: 24,
      color: PALETTE.sub,
      width: 620,
      x: -160,
    });
    this.hint = addLabel(root, 'Hint', '听诊小游戏 W4 接入，此处先占位', 40, {
      size: 24,
      color: PALETTE.sub,
    });
    addButton(root, 'CompleteButton', '完成诊断', -110, () => this.complete());
    addButton(
      root,
      'FailButton',
      '模拟误诊（测试失败路径）',
      -215,
      () => this.showFailurePanel(),
      PALETTE.secondary,
      420,
    );
    this.mountPet(item.petId);
  }

  private mountPet(petId: string): void {
    void CharacterConfig.load().then(() => {
      if (!this.isValid) {
        return;
      }
      CharacterView.mount(this.node, 470, 40).showPet(petId, 'sick');
    });
  }

  private complete(): void {
    const duration = CaseSession.diagnosisDurationMs;
    const stars = duration < 20000 ? 3 : duration < 40000 ? 2 : 1;
    CaseSession.finishDiagnosis(stars, 0);
    void goState(GameState.Treatment, 'Treatment');
  }

  private showFailurePanel(): void {
    if (this.panel) {
      return;
    }
    const root = this.node;
    const panel = addRect(root, 'FailPanel', 0, 900, 420, PALETTE.panel);
    this.panel = panel;
    addLabel(panel, 'FailTitle', '诊断失败，选择一条路继续', 150, { size: 32, width: 820 });
    addButton(panel, 'RetryButton', '免费重试', 40, () => this.retry(), PALETTE.secondary, 420);
    addButton(panel, 'AdButton', '看广告获得线索（占位）', -60, () => void this.watchAd(), PALETTE.accent, 460);
    addButton(panel, 'ItemButton', `道具跳过（${ITEM_SKIP_COST} 金币）`, -160, () => this.useItem(), PALETTE.primary, 460);
  }

  private retry(): void {
    CaseSession.addRetry();
    this.closePanel();
    CaseSession.beginDiagnosis();
    this.setHint('已免费重试，重新开始诊断');
  }

  private useItem(): void {
    if (!Save.spendCoins(ITEM_SKIP_COST)) {
      this.setHint(`金币不足（当前 ${Save.coins}）`);
      return;
    }
    Track.track('diagnosis_item_skip', { cost: ITEM_SKIP_COST });
    CaseSession.finishDiagnosis(1, 2);
    void goState(GameState.Treatment, 'Treatment');
  }

  private async watchAd(): Promise<void> {
    const result = await Ad.showRewarded('extra_check');
    this.setHint(result.ok ? '已获得线索' : '广告未就绪（W2 占位，可走免费重试）');
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
