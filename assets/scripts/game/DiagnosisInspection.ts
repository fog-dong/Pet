// STATUS: implemented, W7 额外检查按钮（每日频控 + 广告位配置校验 + 统一失败文案）
import { Button, Node } from 'cc';
import { adButtonText } from '../cache/AdQuota';
import { adFailHint, canOfferAd, showAd } from '../net/AdGateway';
import { addButton, PALETTE, setButtonState } from '../ui/SceneUI';

export function buildInspection(parent: Node, onWatch: () => void): Button {
  return addButton(parent, 'InspectionButton', '', -312, onWatch, PALETTE.accent, 520, 64);
}

export function refreshInspection(button: Button | null): void {
  if (!button) {
    return;
  }
  setButtonState(
    button,
    canOfferAd('extra_inspection'),
    adButtonText('extra_inspection', '额外检查：再看一处'),
    PALETTE.accent,
  );
}

export async function watchInspection(
  button: Button | null,
  reveal: () => void,
  setHint: (text: string) => void,
): Promise<void> {
  const result = await showAd('extra_inspection');
  if (!result.ok) {
    setHint(adFailHint(result, '今日额外检查次数已用完，可以直接诊断'));
    refreshInspection(button);
    return;
  }
  reveal();
  refreshInspection(button);
  setHint('额外检查给出了一处提示');
}
