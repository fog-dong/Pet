// STATUS: implemented, W3 结算页（总星 = 诊断 + 治疗 + 康复，广告金币翻倍，下一例回大厅）
import { _decorator, Button, Component, Label } from 'cc';
import { CaseSession } from './CaseSession';
import type { CaseReward } from './CaseSettle';
import { Save } from '../cache/Save';
import { AdQuota, adButtonText } from '../cache/AdQuota';
import { showAd } from '../net/AdGateway';
import { GameState } from '../core/GameFSM';
import { goState } from '../core/SceneFlow';
import { addButton, addLabel, PALETTE, setButtonState } from '../ui/SceneUI';

const { ccclass } = _decorator;

function starText(stars: number): string {
  const clamped = Math.max(0, Math.min(3, stars));
  return `${'★'.repeat(clamped)}${'☆'.repeat(3 - clamped)}`;
}

function totalText(): string {
  return `累计金币 ${Save.coins}　累计爱心 ${Save.hearts}　已治愈 ${Save.casesDone} 例`;
}

@ccclass('Result')
export class Result extends Component {
  private reward: CaseReward | null = null;
  private rewardLabel: Label | null = null;
  private totalLabel: Label | null = null;
  private doubleButton: Button | null = null;
  private doubled = false;

  protected start(): void {
    const item = CaseSession.current;
    const reward = CaseSession.settle();
    this.reward = reward;
    const success = reward.stars > 0;
    const root = this.node;
    addLabel(root, 'PageTitle', '结 算', 300, { size: 46 });
    addLabel(root, 'Stars', starText(reward.stars), 210, {
      size: 60,
      color: PALETTE.primary,
    });
    addLabel(
      root,
      'Summary',
      `${item ? item.petName : '本病例'} ${success ? '治疗成功' : '本次未能治愈'}`,
      140,
      { size: 32 },
    );
    if (success) {
      addLabel(
        root,
        'Breakdown',
        `诊断 ${reward.diagnosisStars}★ · 治疗 ${reward.treatmentScore}/3 · 康复 ${reward.recoveryStars}★`,
        85,
        { size: 24, color: PALETTE.sub },
      );
    }
    this.rewardLabel = addLabel(
      root,
      'Reward',
      `金币 +${reward.coins}　爱心 +${reward.hearts}　好感 +${reward.affection}`,
      30,
      { size: 26 },
    );
    addLabel(
      root,
      'Adopted',
      CaseSession.adopted ? '已领养，图鉴更新为「已救助」' : '本次未领养，可以稍后再来',
      -20,
      { size: 22, color: PALETTE.sub },
    );
    this.totalLabel = addLabel(root, 'Total', totalText(), -65, { size: 22, color: PALETTE.sub });
    if (reward.firstClear) {
      addLabel(root, 'FirstClear', '首通奖励已发放（金币 ×1.5）', -108, {
        size: 22,
        color: PALETTE.primary,
      });
    }
    if (success && reward.coins > 0) {
      this.doubleButton = addButton(
        root,
        'DoubleRewardButton',
        '',
        -180,
        () => void this.doubleReward(),
        PALETTE.accent,
        480,
        76,
      );
      this.refreshDouble();
    }
    addButton(root, 'LobbyButton', '下一例', -300, () => {
      void goState(GameState.Lobby, 'Lobby');
    });
  }

  private refreshDouble(): void {
    if (!this.doubleButton) {
      return;
    }
    if (this.doubled) {
      setButtonState(this.doubleButton, false, '本局金币已翻倍');
      return;
    }
    setButtonState(
      this.doubleButton,
      AdQuota.canShow('double_reward'),
      adButtonText('double_reward', '看广告金币 ×2'),
      PALETTE.accent,
    );
  }

  private async doubleReward(): Promise<void> {
    const reward = this.reward;
    if (!reward || this.doubled) {
      return;
    }
    const result = await showAd('double_reward');
    if (!result.ok) {
      this.refreshDouble();
      return;
    }
    this.doubled = true;
    Save.addCoins(reward.coins);
    if (this.rewardLabel) {
      this.rewardLabel.string = `金币 +${reward.coins * 2}　爱心 +${reward.hearts}　好感 +${reward.affection}`;
    }
    if (this.totalLabel) {
      this.totalLabel.string = totalText();
    }
    this.refreshDouble();
  }
}
