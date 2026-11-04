// STATUS: implemented, W25 P2-D 护理卡片（标题/说明/消耗 + 动作按钮 + 单独一行置灰原因，按钮始终保留动作名）
import { Color, Node } from 'cc';
import { addUIButton, setUIButtonState } from './UIButton';
import { makeLabel } from './FontKit';
import { addCard } from './PanelKit';
import { COLORS } from './Tokens';

export interface CareCardSpec {
  title: string;
  desc: string;
  meta: string;
  action: string;
  color: Color;
  onFire: () => void;
}

export interface CareCardHandle {
  update(enabled: boolean, reason: string): void;
}

const CARD_W = 330;
const CARD_H = 200;

export function addCareCard(parent: Node, name: string, x: number, y: number, spec: CareCardSpec): CareCardHandle {
  const card = addCard(parent, name, y, CARD_W, CARD_H, { x, color: COLORS.white });
  makeLabel(card, `${name}Title`, spec.title, 70, { size: 26 });
  makeLabel(card, `${name}Desc`, spec.desc, 36, { size: 16, color: COLORS.sub, width: CARD_W - 40 });
  makeLabel(card, `${name}Meta`, spec.meta, 10, { size: 16, color: COLORS.sub, width: CARD_W - 40 });
  const button = addUIButton(card, `${name}Btn`, spec.action, spec.onFire, {
    y: -50,
    width: 260,
    height: 56,
    color: spec.color,
    fontSize: 22,
  });
  const reason = makeLabel(card, `${name}Why`, '', -86, { size: 15, color: COLORS.sub, width: CARD_W - 30 });
  return {
    update(enabled: boolean, text: string): void {
      // W24-1：置灰不换文案，玩家仍看得见"这里能做的是哪件事"。
      setUIButtonState(button, enabled, spec.action);
      if (reason.isValid) {
        reason.string = text;
        reason.color = enabled ? COLORS.sub : COLORS.danger;
      }
    },
  };
}
