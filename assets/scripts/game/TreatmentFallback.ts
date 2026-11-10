// STATUS: implemented, W3 治疗兜底（缺药 / 缺床位 / 治疗失败的三条免费路径）；W25 P2-A2 重试用尽改为抢救窗口提示
import type { Node } from 'cc';
import { Hospital } from './Hospital';
import { CaseCrisis } from './CaseCrisis';
import { adButtonText } from '../cache/AdQuota';
import { isAdConfigured } from '../config/AdConfig';
import { adFailHint, canOfferAd, showAd } from '../net/AdGateway';
import { Track } from '../track/Track';
import { ChoicePanel, PanelAction } from '../ui/ChoicePanel';
import { PALETTE } from '../ui/SceneUI';

const WAIT_SECONDS = 3;

type FillKind = 'ad' | 'friend' | 'wait';

export interface TreatmentFallbackHooks {
  root: () => Node;
  requiredMedicine: () => string;
  onMedicineReady: (name: string) => void;
  onBedReady: () => void;
  onOutpatient: () => void;
  status: (text: string) => void;
  schedule: (fn: () => void, seconds: number) => void;
}

export class TreatmentFallback {
  private focus = '';

  constructor(
    private readonly hooks: TreatmentFallbackHooks,
    private readonly panel: ChoicePanel,
  ) {}

  medicineShortage(name: string, withRetry: boolean): void {
    this.focus = name || this.hooks.requiredMedicine();
    this.panel.open(this.hooks.root(), `「${this.focus}」库存不足`, this.medicineActions(withRetry));
    this.panel.setHint(
      isAdConfigured('extra_medicine')
        ? '广告 / 好友送药 / 等待补给，三条免费路径都能继续。'
        : '好友送药 / 等待补给，两条免费路径都能继续。',
    );
  }

  /**
   * 治疗没达标。inCrisis 为重试用尽：不再给第 4 次免费重试之外的说法，
   * 直接把抢救窗口写在面板上，倒计时归零就由 CrisisHud 触发转院。
   */
  failure(score: number, name: string, threshold = 2, inCrisis = false): void {
    this.focus = name || this.hooks.requiredMedicine();
    if (inCrisis) {
      const seconds = CaseCrisis.view().seconds;
      this.panel.open(this.hooks.root(), `治疗评分 ${score}/3，重试用尽`, this.medicineActions(true));
      this.panel.setHint(`病情在恶化，抢救只剩 ${seconds}s，时间到就得转院。`);
      return;
    }
    const reason = threshold >= 3 ? '危重病例需要 3/3 全对' : '还差一点';
    this.panel.open(this.hooks.root(), `治疗评分 ${score}/3，${reason}`, this.medicineActions(true));
    this.panel.setHint('可以免费重试，也可以补一个对症药再来。');
  }

  bedShortage(): void {
    const actions: PanelAction[] = [
      {
        text: '改门诊治疗（评分略低）',
        action: () => {
          this.panel.close();
          this.hooks.onOutpatient();
        },
        color: PALETTE.primary,
      },
    ];
    // 未配置广告位时整条入口不渲染：提审包里不能出现「暂未开放」的选项。
    if (isAdConfigured('extra_bed')) {
      actions.push({
        text: adButtonText('extra_bed', '看广告临时加床'),
        action: () => this.fillBed('ad'),
        disabled: !canOfferAd('extra_bed'),
      });
    }
    actions.push(
      { text: '好友腾床 +1', action: () => this.fillBed('friend') },
      { text: '等待空床（3 秒）', action: () => this.fillBed('wait') },
    );
    this.panel.open(this.hooks.root(), '床位已满', actions);
    this.panel.setHint(`当前 ${Hospital.bedsOccupied}/${Hospital.bedsOwned}，改门诊也能完成治疗。`);
  }

  private medicineActions(withRetry: boolean): PanelAction[] {
    const actions: PanelAction[] = [];
    if (withRetry) {
      actions.push({
        text: '免费重试（重新选择）',
        action: () => this.panel.close(),
        color: PALETTE.primary,
      });
    }
    if (isAdConfigured('extra_medicine')) {
      actions.push({
        text: adButtonText('extra_medicine', '看广告补药'),
        action: () => this.fillMedicine('ad'),
        disabled: !canOfferAd('extra_medicine'),
      });
    }
    actions.push(
      { text: '好友送药 +1', action: () => this.fillMedicine('friend') },
      { text: '等待补给（3 秒）', action: () => this.fillMedicine('wait') },
    );
    return actions;
  }

  private fillMedicine(kind: FillKind): void {
    const name = this.focus;
    if (kind === 'wait') {
      this.panel.setHint('补给中，3 秒后到账…');
      this.hooks.schedule(() => this.grantMedicine(name), WAIT_SECONDS);
      return;
    }
    if (kind === 'friend') {
      Track.track('friend_assist', { target: 'medicine', medicine: name });
      this.grantMedicine(name);
      return;
    }
    void showAd('extra_medicine').then((result) => {
      if (!result.ok) {
        this.panel.setHint(adFailHint(result, '今日广告补药次数已用完，可改用好友送药或等待补给。'));
        return;
      }
      this.grantMedicine(name);
    });
  }

  private grantMedicine(name: string): void {
    Hospital.addMedicine(name, 1);
    this.panel.close();
    this.hooks.onMedicineReady(name);
    this.hooks.status(`补到 1 个「${name}」，可以开始治疗了`);
  }

  private fillBed(kind: FillKind): void {
    if (kind === 'wait') {
      this.panel.setHint('腾床中，3 秒后到账…');
      this.hooks.schedule(() => this.releaseBed(), WAIT_SECONDS);
      return;
    }
    if (kind === 'friend') {
      Track.track('friend_assist', { target: 'bed' });
      this.releaseBed();
      return;
    }
    void showAd('extra_bed').then((result) => {
      if (!result.ok) {
        this.panel.setHint(adFailHint(result, '今日广告加床次数已用完，可改用好友腾床或等待。'));
        return;
      }
      this.releaseBed();
    });
  }

  private releaseBed(): void {
    Hospital.freeBed();
    this.panel.close();
    this.hooks.onBedReady();
  }
}
