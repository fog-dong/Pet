// STATUS: implemented, W20-4 小屋底部（离线收益领取回执 + 关闭）；面板守 150 行红线，领取反馈单独成文件
import { Button, Node } from 'cc';
import { claimOfflineEarnings } from '../game/HabitatClaim';
import { fitRow } from './ScreenMetrics';
import { floatText } from './FloatText';
import { showToast } from './Toast';
import { COLORS } from './Tokens';
import { addUIButton, setUIButtonState } from './UIButton';

const CLAIM_LABEL = '离线收益 · 待领取';
const CLAIM_DONE = '离线收益 · 已领取';
/** 飘字落在按钮上方，视线从按钮移到数字只需一小跳。 */
const CLAIM_FLOAT_Y = -290;

/**
 * 底部两枚按钮：离线收益只由服务端事务计时结算（G4 红线），客户端只发领取请求并照抄返回数额；
 * 右侧留关闭，主次同排不抢列表的视觉重心。
 */
export function buildHabitatFooter(
  panel: Node,
  panelWidth: number,
  toastHost: Node,
  onClose: () => void,
  onResourcesChanged?: () => void,
): void {
  const row = fitRow(2, -(panelWidth / 2 - 40), panelWidth / 2 - 40, 24);
  const claim = addUIButton(panel, 'HabitatClaim', CLAIM_LABEL, () => {
    void claimReward(panel, claim, toastHost, onResourcesChanged);
  }, {
    y: -340,
    x: row.x0,
    width: row.width,
    height: 76,
    color: COLORS.gold,
    fontSize: 26,
  });
  addUIButton(panel, 'HabitatClose', '关 闭', onClose, {
    y: -340,
    x: row.x0 + row.step,
    width: row.width,
    height: 76,
    color: COLORS.sage,
    fontSize: 28,
  });
}

/** 领取结果一律给反馈：成功飘金币 + 按钮转「已领取」；频控与断网只给 Toast，连点第二个请求静默吞掉。 */
async function claimReward(
  panel: Node,
  claim: Button,
  toastHost: Node,
  onResourcesChanged?: () => void,
): Promise<void> {
  const outcome = await claimOfflineEarnings();
  if (outcome.kind === 'busy') {
    return;
  }
  if (outcome.kind === 'granted') {
    if (panel.isValid) {
      floatText(panel, `+${outcome.coins} 金币`, 0, CLAIM_FLOAT_Y);
    }
    if (claim.isValid) {
      setUIButtonState(claim, false, CLAIM_DONE, COLORS.gold);
    }
    if (onResourcesChanged) {
      onResourcesChanged();
    }
  }
  showToast(toastHost, outcome.text);
}
