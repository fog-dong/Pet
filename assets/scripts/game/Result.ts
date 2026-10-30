// STATUS: implemented, W3 结算页（总星 = 诊断 + 治疗 + 康复，广告金币翻倍，下一例回大厅）
import { _decorator, Button, Component, Label } from 'cc';
import { CaseSession } from './CaseSession';
import type { CaseReward } from './CaseSettle';
import { Save } from '../cache/Save';
import { adButtonText } from '../cache/AdQuota';
import { adFailHint, canOfferAd, showAd } from '../net/AdGateway';
import { pushHint, pushSave } from '../net/CloudSave';
import { syncCaseResult, flushPending } from '../net/SyncCaseResult';
import { GameState } from '../core/GameFSM';
import { goState } from '../core/SceneFlow';
import { addButton, addLabel, PALETTE, setButtonState } from '../ui/SceneUI';
import { buildSaveSnapshot } from './CloudPayload';
import { starText, totalText } from './ResultText';

const { ccclass } = _decorator;

@ccclass('Result')
export class Result extends Component {
  private reward: CaseReward | null = null;
  private rewardLabel: Label | null = null;
  private totalLabel: Label | null = null;
  private doubleButton: Button | null = null;
  private syncHint: Label | null = null;
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
    this.syncHint = addLabel(root, 'SyncHint', '', -238, { size: 18, color: PALETTE.sub });
    void this.sync(reward);
  }

  private async sync(reward: CaseReward): Promise<void> {
    const input = CaseSession.report(reward.durationMs);
    if (input) {
      const response = await syncCaseResult(input);
      // 本局入账成功后再补发历史积压（配置晚发布时积压会在这一刻清算）。
      if (response.code === 0) {
        void flushPending();
      }
    }
    const pushed = await pushSave(buildSaveSnapshot(Save.snapshot()));
    if (this.isValid && this.syncHint) {
      this.syncHint.string = pushHint(pushed);
    }
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
      canOfferAd('double_reward'),
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
      if (this.syncHint) {
        this.syncHint.string = adFailHint(result, '今日翻倍次数已用完，可直接进入下一例');
      }
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
