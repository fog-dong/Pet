// STATUS: implemented, W16 P1 结算页广告翻倍（可用性 / 每日次数 / 失败 Toast 集中在这里，Result 只管排版）
import type { Button, Node } from 'cc';
import { adButtonText } from '../cache/AdQuota';
import { Save } from '../cache/Save';
import { adFailHint, canOfferAd, showAd } from '../net/AdGateway';
import { addButton, PALETTE, setButtonState } from '../ui/SceneUI';
import { showToast } from '../ui/Toast';
import type { CaseReward } from './CaseSettle';

export interface DoubleRewardOptions {
  y: number;
  toastY: number;
  alive: () => boolean;
  onApplied: (coins: number) => void;
}

export class DoubleReward {
  private button: Button | null = null;
  private doubled = false;

  constructor(
    private readonly parent: Node,
    private readonly reward: CaseReward,
    private readonly options: DoubleRewardOptions,
  ) {}

  mount(): void {
    this.button = addButton(
      this.parent,
      'DoubleRewardButton',
      '',
      this.options.y,
      () => void this.run(),
      PALETTE.accent,
      480,
      84,
    );
    this.refresh();
  }

  private async run(): Promise<void> {
    if (this.doubled) {
      return;
    }
    const result = await showAd('double_reward');
    if (!result.ok) {
      if (this.options.alive()) {
        showToast(this.parent, adFailHint(result, '今日翻倍次数已用完，可直接进入下一例'), {
          y: this.options.toastY,
        });
      }
      this.refresh();
      return;
    }
    this.doubled = true;
    Save.addCoins(this.reward.coins);
    this.options.onApplied(this.reward.coins * 2);
    this.refresh();
  }

  private refresh(): void {
    if (!this.button) {
      return;
    }
    if (this.doubled) {
      setButtonState(this.button, false, '本局金币已翻倍');
      return;
    }
    setButtonState(
      this.button,
      canOfferAd('double_reward'),
      adButtonText('double_reward', '看广告金币 ×2'),
      PALETTE.accent,
    );
  }
}
