// STATUS: implemented, W16 P1 结算页装饰件（明细 chip + 金币/爱心奖励卡 + 奖励飘字）
import type { Color, Label, Node } from 'cc';
import { floatText } from '../ui/FloatText';
import { makeLabel } from '../ui/FontKit';
import { addCard, addPill } from '../ui/PanelKit';
import { COLORS, tint } from '../ui/Tokens';
import type { CaseReward } from './CaseSettle';

const CARD_W = 296;
const CARD_H = 156;
const CARD_X = 158;
const CHIP_W = 196;
const CHIP_H = 58;
const CHIP_GAP = 208;

export interface RewardHandle {
  coins: Label;
  hearts: Label;
}

/** 分母不进文案：拿到几颗就填几颗。 */
function dots(filled: number): string {
  const value = Math.max(0, Math.min(3, Math.round(filled)));
  return `${'●'.repeat(value)}${'○'.repeat(3 - value)}`;
}

function addChip(parent: Node, name: string, text: string, x: number, y: number, color: Color): void {
  addPill(parent, name, y, CHIP_W, CHIP_H, color, x);
  makeLabel(parent, `${name}Label`, text, y, { size: 24, width: CHIP_W - 20, x, color: COLORS.ink });
}

export function addBreakdown(parent: Node, reward: CaseReward, y: number): void {
  addChip(parent, 'DiagnosisChip', `诊断 ${dots(reward.diagnosisStars)}`, -CHIP_GAP, y, tint('#EDF4EA'));
  addChip(parent, 'TreatmentChip', `治疗 ${reward.treatmentScore}/3`, 0, y, tint('#E9F1F6'));
  addChip(parent, 'RecoveryChip', `康复 ${dots(reward.recoveryStars)}`, CHIP_GAP, y, tint('#FAF0E4'));
}

function addResourceCard(
  parent: Node,
  name: string,
  x: number,
  y: number,
  dot: Color,
  caption: string,
): Label {
  const card = addCard(parent, name, y, CARD_W, CARD_H, { x });
  addPill(card, `${name}Dot`, 24, 36, 36, dot, -96);
  makeLabel(card, `${name}Caption`, caption, -36, { size: 22, color: COLORS.sub });
  return makeLabel(card, `${name}Value`, '+0', 24, { size: 44, width: CARD_W - 40 });
}

export function addReward(parent: Node, reward: CaseReward, y: number): RewardHandle {
  const handle: RewardHandle = {
    coins: addResourceCard(parent, 'CoinCard', -CARD_X, y, COLORS.gold, '金币'),
    hearts: addResourceCard(parent, 'HeartCard', CARD_X, y, COLORS.danger, '爱心'),
  };
  refreshReward(handle, reward.coins, reward.hearts);
  if (reward.affection > 0) {
    makeLabel(parent, 'AffectionGain', `好感 +${reward.affection}`, y - CARD_H / 2 - 26, {
      size: 22,
      color: COLORS.sub,
    });
  }
  return handle;
}

/** 广告翻倍后原地改数字，不改卡片结构。 */
export function refreshReward(handle: RewardHandle, coins: number, hearts: number): void {
  handle.coins.string = `+${coins}`;
  handle.hearts.string = `+${hearts}`;
}

/** 从卡片中央上浮，落点仍在这张卡内，不压到上方的明细 chip。 */
export function floatReward(parent: Node, coins: number, hearts: number, y: number): void {
  if (coins > 0) {
    floatText(parent, `+${coins}`, -CARD_X, y + 8, COLORS.gold);
  }
  if (hearts > 0) {
    floatText(parent, `+${hearts}`, CARD_X, y + 8, COLORS.danger);
  }
}
