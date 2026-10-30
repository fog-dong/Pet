// STATUS: implemented, W5 领养页布局（好感度门槛 / 三种腾位路径 / 领养按钮）
import { Node, UITransform } from 'cc';
import { adButtonText } from '../cache/AdQuota';
import { canOfferAd } from '../net/AdGateway';
import { addButton, addLabel, addProgressBar, PALETTE, setButtonState } from './SceneUI';

export interface AdoptionState {
  affection: number;
  threshold: number;
  slots: number;
  adoptedCount: number;
  waiting: number;
  slotFree: boolean;
}

export interface AdoptionHandlers {
  shareAssist(): void;
  shareSlot(): void;
  adSlot(): void;
  startWait(): void;
  adopt(): void;
  leave(): void;
}

function waitText(waiting: number): string {
  return waiting > 0 ? `等待中 ${waiting}s` : '等 10 秒自然恢复一位（免费）';
}

export function renderAdoptionBody(
  parent: Node,
  state: AdoptionState,
  handlers: AdoptionHandlers,
): Node {
  const body = new Node('AdoptionBody');
  body.parent = parent;
  body.addComponent(UITransform).setContentSize(1280, 720);
  addLabel(body, 'AffectionLabel', `好感度 ${state.affection}/${state.threshold}`, 195, { size: 26 });
  const redraw = addProgressBar(body, 'AffectionBar', 150, 620, 36);
  redraw(Math.min(1, state.affection / Math.max(1, state.threshold)));

  if (state.affection < state.threshold) {
    addLabel(body, 'LockHint', '好感度还不够；也可以分享求助，让好友来搭把手', 40, {
      size: 22,
      color: PALETTE.sub,
      width: 900,
    });
    addButton(body, 'ShareAffection', '分享求助 +1 好感', -60, handlers.shareAssist, PALETTE.secondary, 560);
    addButton(body, 'LaterButton', '稍后再说', -170, handlers.leave, PALETTE.secondary, 360);
    return body;
  }

  addLabel(body, 'SlotLabel', `领养位 ${state.adoptedCount}/${state.slots}`, 40, {
    size: 24,
    color: PALETTE.sub,
  });

  if (!state.slotFree) {
    addButton(body, 'ShareSlot', '分享求助腾位', -35, handlers.shareSlot, PALETTE.secondary, 480);
    const adButton = addButton(body, 'AdSlot', '', -115, handlers.adSlot, PALETTE.accent, 480);
    setButtonState(adButton, canOfferAd('free_slot'), adButtonText('free_slot', '看广告腾位'), PALETTE.accent);
    addButton(body, 'WaitSlot', waitText(state.waiting), -195, handlers.startWait, PALETTE.secondary, 480);
    addButton(body, 'LaterSlot', '稍后再说', -275, handlers.leave, PALETTE.secondary, 300);
    return body;
  }

  addButton(body, 'AdoptButton', '领养它', -60, handlers.adopt, PALETTE.primary);
  addButton(body, 'LaterButton', '稍后再说', -170, handlers.leave, PALETTE.secondary);
  return body;
}
