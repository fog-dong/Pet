// STATUS: implemented, W16 领养页布局（头部宠物卡 + 暖粉好感度条 + 三种腾位路径）；W17-3 达标跳跃/未达标休息
import { Node, UITransform } from 'cc';
import { adButtonText } from '../cache/AdQuota';
import { CharacterConfig } from '../config/CharacterConfig';
import { canOfferAd } from '../net/AdGateway';
import { PetVisual } from '../game/PetVisual';
import { addButton, addLabel, PALETTE, setButtonState } from './SceneUI';
import { addCard } from './PanelKit';
import { addGradientBar } from './GradientBar';
import { buildAdoptionMessage, buildTraitRow, adoptionTraits } from './AdoptionNote';
import { screenHeight, screenWidth } from './ScreenMetrics';

export interface AdoptionState {
  petId: string;
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

const CARD_W = 660;
const CARD_Y = 340;
const CARD_H = 320;

function waitText(waiting: number): string {
  return waiting > 0 ? `等待中 ${waiting}s` : '等 10 秒自然恢复一位（免费）';
}

/** 头部卡：左侧立绘、右侧名字与好感度，进度条与性格标签压在卡片下半部。 */
function buildHeader(body: Node, state: AdoptionState): void {
  const card = addCard(body, 'AdoptionHeader', CARD_Y, CARD_W, CARD_H);
  const pet = CharacterConfig.petById(state.petId);
  const visual = PetVisual.mount(card, 180, false);
  visual.node.setPosition(-CARD_W / 2 + 120, 20, 0);
  visual.apply(state.petId);
  // 好感达标 → 开心跳跃；还没攒够 → 趴着休息，和「稍后再说」的语义一致。
  visual.playState(state.affection >= state.threshold ? 'happy' : 'sleep');
  addLabel(card, 'PetName', pet ? pet.name : '待领养', 106, { size: 34, width: 320, x: 96 });
  addLabel(card, 'PetBreed', pet ? `${pet.breed} · 已救助` : '已救助', 64, {
    size: 22,
    color: PALETTE.sub,
    width: 320,
    x: 96,
  });
  // 好感度可以靠分享求助超过门槛，但展示按门槛封顶，避免出现「8/4」这种看着像 bug 的数字。
  const shown = Math.min(state.affection, state.threshold);
  addLabel(card, 'AffectionLabel', `好感度 ${shown}/${state.threshold}`, 24, {
    size: 24,
    width: 300,
    x: 96,
  });
  const redraw = addGradientBar(card, 'AffectionBar', -20, 360, 24, 96);
  redraw(Math.min(1, shown / Math.max(1, state.threshold)));
  buildTraitRow(card, adoptionTraits(pet, state.petId), -84);
}

export function renderAdoptionBody(
  parent: Node,
  state: AdoptionState,
  handlers: AdoptionHandlers,
): Node {
  const body = new Node('AdoptionBody');
  body.parent = parent;
  body.addComponent(UITransform).setContentSize(screenWidth(), screenHeight());
  buildHeader(body, state);
  buildAdoptionMessage(body, CharacterConfig.petById(state.petId), state.petId, 100);

  if (state.affection < state.threshold) {
    const gap = state.threshold - state.affection;
    addLabel(body, 'LockHint', `好感还差 ${gap} 点：诊断、治疗、对症用药、康复护理都会累积`, 0, {
      size: 22,
      color: PALETTE.sub,
      width: 620,
    });
    addButton(body, 'ShareAffection', '分享求助 +5 好感', -84, handlers.shareAssist, PALETTE.secondary, 520, 84);
    addButton(body, 'LaterButton', '稍后再说', -180, handlers.leave, PALETTE.secondary, 340, 80);
    return body;
  }

  addLabel(body, 'SlotLabel', `领养位 ${state.adoptedCount}/${state.slots}`, 0, {
    size: 24,
    color: PALETTE.sub,
  });

  if (!state.slotFree) {
    addButton(body, 'ShareSlot', '分享求助腾位', -66, handlers.shareSlot, PALETTE.secondary, 480, 82);
    const adButton = addButton(body, 'AdSlot', '', -151, handlers.adSlot, PALETTE.accent, 480, 82);
    setButtonState(adButton, canOfferAd('free_slot'), adButtonText('free_slot', '看广告腾位'), PALETTE.accent);
    addButton(body, 'WaitSlot', waitText(state.waiting), -236, handlers.startWait, PALETTE.secondary, 480, 82);
    addButton(body, 'LaterSlot', '稍后再说', -320, handlers.leave, PALETTE.secondary, 300, 76);
    return body;
  }

  addButton(body, 'AdoptButton', '领养它', -66, handlers.adopt, PALETTE.primary, 420, 88);
  addButton(body, 'LaterButton', '稍后再说', -176, handlers.leave, PALETTE.secondary, 340, 80);
  return body;
}
