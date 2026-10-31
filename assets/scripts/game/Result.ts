// STATUS: implemented, W16 P1 结算页（星级逐颗弹出 + 奖励上浮 + 同步状态走 Toast）
import { _decorator, Component, Label } from 'cc';
import { Save } from '../cache/Save';
import { COPY, fillCopy } from '../config/CopyText';
import { GameState } from '../core/GameFSM';
import { goState } from '../core/SceneFlow';
import { pushHint, pushSave } from '../net/CloudSave';
import { flushPending, syncCaseResult } from '../net/SyncCaseResult';
import { mountBackButton } from '../ui/BackButton';
import { mountBackdrop } from '../ui/Backdrop';
import { addButton, addLabel, PALETTE } from '../ui/SceneUI';
import { showStars } from '../ui/StarRow';
import { showToast } from '../ui/Toast';
import { CaseSession } from './CaseSession';
import type { CaseReward } from './CaseSettle';
import { buildSaveSnapshot } from './CloudPayload';
import { DoubleReward } from './ResultAd';
import { totalText } from './ResultText';
import { addBreakdown, addReward, floatReward, refreshReward } from './ResultView';
import type { RewardHandle } from './ResultView';

const { ccclass } = _decorator;

const TITLE_Y = 520;
const SUMMARY_Y = 448;
const STARS_Y = 352;
const CHIP_Y = 252;
const REWARD_Y = 95;
const AD_Y = -215;
const MAIN_Y = -335;
const TOAST_Y = -480;

@ccclass('Result')
export class Result extends Component {
  private handle: RewardHandle | null = null;
  private totalLabel: Label | null = null;

  protected start(): void {
    const item = CaseSession.current;
    const reward = CaseSession.settle();
    const success = reward.stars > 0;
    const root = this.node;
    mountBackdrop(root, 'result');
    addLabel(root, 'PageTitle', COPY.resultTitle, TITLE_Y, { size: 52 });
    addLabel(
      root,
      'Summary',
      success ? fillCopy(COPY.resultSuccess, { pet: item ? item.petName : '宝贝' }) : COPY.resultFail,
      SUMMARY_Y,
      { size: 30, color: PALETTE.sub },
    );
    addBreakdown(root, reward, CHIP_Y);
    this.handle = addReward(root, reward, REWARD_Y);
    addLabel(
      root,
      'Adopted',
      CaseSession.adopted ? '已领养，图鉴更新为「已救助」' : '本次未领养，可以稍后再来',
      -60,
      { size: 22, color: PALETTE.sub },
    );
    if (reward.firstClear) {
      addLabel(root, 'FirstClear', COPY.resultFirstClear, -98, { size: 22, color: PALETTE.primary });
    }
    this.totalLabel = addLabel(root, 'Total', totalText(), -136, { size: 20, color: PALETTE.sub });
    if (success && reward.coins > 0) {
      new DoubleReward(root, reward, {
        y: AD_Y,
        toastY: TOAST_Y,
        alive: () => this.isValid,
        onApplied: (coins) => this.onDoubled(reward, coins),
      }).mount();
    }
    addButton(
      root,
      'LobbyButton',
      COPY.resultNext,
      MAIN_Y,
      () => {
        void goState(GameState.Lobby, 'Lobby');
      },
      PALETTE.primary,
      520,
      112,
    );
    mountBackButton(root, () => {
      void goState(GameState.Lobby, 'Lobby');
    });
    void this.playStars(reward);
    void this.sync(reward);
  }

  /** 广告只看一次：翻倍后的金币就地改数字，再把本局金币飘一次。 */
  private onDoubled(reward: CaseReward, coins: number): void {
    if (this.handle) {
      refreshReward(this.handle, coins, reward.hearts);
    }
    if (this.totalLabel) {
      this.totalLabel.string = totalText();
    }
    floatReward(this.node, reward.coins, 0, REWARD_Y);
  }

  private async playStars(reward: CaseReward): Promise<void> {
    await showStars(this.node, reward.stars, STARS_Y, { size: 86, gap: 116 });
    if (!this.isValid) {
      return;
    }
    floatReward(this.node, reward.coins, reward.hearts, REWARD_Y);
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
    const hint = pushHint(pushed);
    if (this.isValid && hint) {
      showToast(this.node, hint, { y: TOAST_Y });
    }
  }
}
