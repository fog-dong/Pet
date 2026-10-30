// STATUS: implemented, W3 诊断失败兜底（重试 / 广告线索 / 电池跳过，广告带频控）
import type { Node } from 'cc';
import { AdQuota, adButtonText } from '../cache/AdQuota';
import { showAd } from '../net/AdGateway';
import { ChoicePanel, PanelAction } from '../ui/ChoicePanel';
import { PALETTE } from '../ui/SceneUI';

export interface DiagnosisFallbackHooks {
  root: () => Node;
  retry: (withHint: boolean) => void;
  useBattery: () => void;
  status: (text: string) => void;
}

export class DiagnosisFallback {
  constructor(
    private readonly hooks: DiagnosisFallbackHooks,
    private readonly panel: ChoicePanel,
  ) {}

  open(): void {
    const available = AdQuota.canShow('extra_check');
    const actions: PanelAction[] = [
      {
        text: '免费重试',
        action: () => {
          this.panel.close();
          this.hooks.retry(false);
        },
      },
      {
        text: adButtonText('extra_check', '看广告获得线索'),
        action: () => void this.watch(),
        color: PALETTE.accent,
        disabled: !available,
      },
      {
        text: '用听诊器电池跳过',
        action: () => {
          this.panel.close();
          this.hooks.useBattery();
        },
        color: PALETTE.primary,
      },
    ];
    this.panel.open(this.hooks.root(), '这次没查完，选一条路继续', actions);
    this.panel.setHint('三条路都不需要付费，电池用完也能免费重试。');
  }

  private async watch(): Promise<void> {
    const result = await showAd('extra_check');
    if (!result.ok) {
      this.panel.setHint('广告未就绪（本地占位），可直接免费重试');
      return;
    }
    this.panel.close();
    this.hooks.retry(true);
    this.hooks.status('已点亮一处异常，慢慢来');
  }
}
