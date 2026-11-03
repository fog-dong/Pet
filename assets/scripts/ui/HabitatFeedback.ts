// STATUS: implemented, W25 P0-A 小屋互动反馈（音效 + 飘字 + 安抚提示 + Q 弹/抛物线/粒子；规格见方案 §4.3）
// 立绘位与四枚动作的色相都归这里定义，触点侧只负责摆位置，反馈用同一组常量对齐视觉。
import { Color, Node } from 'cc';
import { HabitatOutcome } from '../game/HabitatModel';
import { AILMENT_HEART_COST } from '../game/HabitatDecay';
import { HabitatAction } from '../game/HabitatRules';
import { PetVisual } from '../game/PetVisual';
import { Sfx } from '../game/Sfx';
import { floatText } from './FloatText';
import { chew, squash } from './MotionKit';
import { Point, spawnBubbles, spawnHearts, tossTo } from './ParticleKit';
import { COLORS } from './Tokens';

export const PORTRAIT_X = -150;
export const PORTRAIT_Y = -10;

export const TINT: Record<HabitatAction, Color> = {
  feed: COLORS.gold,
  // 高级粮与普通喂食同属「吃」，但档位要看得出来：用深木色 sub，既不与雾蓝/陶土撞色，也撑得住白字。
  premium: COLORS.sub,
  bath: COLORS.mist,
  pet: COLORS.clay,
};

/**
 * 被拦住只说原因；成交才播音效与飘字，飘字落在立绘上方而不是按钮上，视线跟着宠物走。
 * origin 是道具的起飞点（触点坐标），缺省表示这次不做抛物线——由触点侧按实际布局传入。
 */
export function playFeedback(
  host: Node,
  action: HabitatAction,
  visual: PetVisual,
  outcome: HabitatOutcome,
  notify: (text: string) => void,
  origin?: Point,
  touchX = 0,
): void {
  if (outcome.kind === 'blocked') {
    notify(outcome.text);
    return;
  }
  const rule = outcome.rule;
  Sfx.play(rule.cue);
  floatText(host, outcome.floatText, PORTRAIT_X, PORTRAIT_Y + 70, TINT[action]);
  if (outcome.soothed) {
    notify(`它有点闹脾气，顺手安抚了一下（−${AILMENT_HEART_COST} 爱心）`);
  }
  const content = visual.contentNode;
  if (action === 'pet') {
    squash(content, touchX);
    spawnHearts(host, { x: PORTRAIT_X, y: PORTRAIT_Y + 30 });
  } else if (action === 'bath') {
    spawnBubbles(host, { x: PORTRAIT_X, y: PORTRAIT_Y - 30 });
  } else if (origin && content) {
    tossTo(host, origin, { x: PORTRAIT_X, y: PORTRAIT_Y + 10 }, action === 'premium' ? 'pellet' : 'bone', () => chew(content));
  }
}
