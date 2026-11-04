// STATUS: implemented, W25 P2-D 送养动作区（提交/审核中/领结果三种视图；每秒只刷倒计时，到点才重建一次）
import { Button, Color, Label, Node } from 'cc';
import { RehomeConfig } from '../config/RehomeConfig';
import { claimReview, pendingReview, reviewLeftMs, RehomeClaim, skipReview, startRehome, waitText } from '../game/RehomeModel';
import { addLabel, createNode } from './SceneUI';
import { addUIButton, setUIButtonState } from './UIButton';
import { COLORS } from './Tokens';

export interface RehomeHost {
  notify(text: string): void;
  onChanged(): void;
  onClaim(claim: RehomeClaim): void;
  onClose(): void;
}

export interface RehomeActionsHandle {
  tick(): void;
}

/** 动作区固定占面板下半栏，按状态换三套视图；三枚按钮的 y 一致，视觉重心不跳。 */
export function buildRehomeActions(
  panel: Node,
  petId: string,
  host: RehomeHost,
): RehomeActionsHandle {
  const zone = createNode(panel, 'RehomeActions', 0, 640, 860);
  let status: Label | null = null;
  let showingReady = false;

  function render(): void {
    zone.destroyAllChildren();
    status = null;
    showingReady = false;
    const review = pendingReview();
    if (!review) {
      renderStart();
      return;
    }
    if (review.petId !== petId) {
      addLabel(zone, 'RehomeOther', '另一只宠物正在审核中，先处理它吧', -150, {
        size: 22,
        color: COLORS.sub,
        width: 600,
      });
      buildButton(zone, 'RehomeBusy', '已在审核中', false, COLORS.disabled, -215, () => undefined);
      buildClose();
      return;
    }
    const left = reviewLeftMs();
    if (left > 0) {
      status = addLabel(zone, 'RehomeWait', `审核中 · 还需 ${waitText(left)}`, -150, {
        size: 22,
        width: 600,
      });
      buildButton(zone, 'RehomeSkip', `花 ${RehomeConfig.value.cost.skipHearts} 爱心 · 立即出结果`, true, COLORS.gold, -215, () => {
        host.onClaim(skipReview());
      });
      buildClose();
      return;
    }
    showingReady = true;
    addLabel(zone, 'RehomeReady', '审核结果出来啦', -150, { size: 22, color: COLORS.sage });
    buildButton(zone, 'RehomeClaim', '查看审核结果', true, COLORS.gold, -215, () => {
      host.onClaim(claimReview());
    });
    buildClose();
  }

  function renderStart(): void {
    const config = RehomeConfig.value;
    addLabel(zone, 'RehomeTip', `提交后等待 30 分钟 · 可用 ${config.cost.skipHearts} 爱心跳过`, -150, {
      size: 18,
      color: COLORS.sub,
      width: 600,
    });
    buildButton(zone, 'RehomePayCoins', `花 ${config.cost.coins} 金币送养`, true, COLORS.clay, -215, () => {
      start('coins');
    });
    buildButton(zone, 'RehomePayHearts', `花 ${config.cost.hearts} 爱心送养`, true, COLORS.clay, -290, () => {
      start('hearts');
    });
    buildClose();
  }

  function buildClose(): void {
    buildButton(zone, 'RehomeClose', '返 回', true, COLORS.sage, -372, host.onClose, 56);
  }

  /** 余额不足仍可点：数据层会给出准确差多少，按钮不必自己猜。 */
  function start(pay: 'coins' | 'hearts'): void {
    const result = startRehome(petId, pay);
    if (result.kind === 'blocked') {
      host.notify(result.text);
      return;
    }
    render();
    host.onChanged();
  }

  render();
  return {
    tick(): void {
      const review = pendingReview();
      if (!review || review.petId !== petId) {
        return;
      }
      const left = reviewLeftMs();
      if (left > 0) {
        if (status && status.isValid) {
          status.string = `审核中 · 还需 ${waitText(left)}`;
        }
        return;
      }
      if (!showingReady) {
        render();
      }
    },
  };
}

function buildButton(
  parent: Node,
  name: string,
  text: string,
  enabled: boolean,
  color: Color,
  y: number,
  onClick: () => void,
  height = 66,
): Button {
  const button = addUIButton(parent, name, text, onClick, {
    y,
    width: 520,
    height,
    color,
    fontSize: 26,
  });
  if (!enabled) {
    setUIButtonState(button, false, text);
  }
  return button;
}
