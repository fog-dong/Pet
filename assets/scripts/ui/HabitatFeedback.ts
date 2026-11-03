// STATUS: implemented, W23-2 小屋互动反馈（音效 + 飘字 + 安抚提示 + 抚摸 ±4° 摇摆；自 HabitatMenu 拆出保持单文件 ≤150 行）
// 立绘位与四枚按钮的色相都归这里定义，菜单只负责摆按钮，飘字与摇摆用同一组常量对齐视觉。
import { Color, Node, Tween, tween } from 'cc';
import { Quality } from '../config/Quality';
import { HabitatOutcome } from '../game/HabitatModel';
import { AILMENT_HEART_COST } from '../game/HabitatDecay';
import { HabitatAction } from '../game/HabitatRules';
import { PetVisual } from '../game/PetVisual';
import { Sfx } from '../game/Sfx';
import { floatText } from './FloatText';
import { COLORS } from './Tokens';

export const PORTRAIT_X = -150;
export const PORTRAIT_Y = -10;
const ROCK_ANGLE = 4;

export const TINT: Record<HabitatAction, Color> = {
  feed: COLORS.gold,
  // 高级粮与普通喂食同属「吃」，但档位要看得出来：用深木色 sub，既不与雾蓝/陶土撞色，也撑得住白字。
  premium: COLORS.sub,
  bath: COLORS.mist,
  pet: COLORS.clay,
};

/** 被拦住只说原因；成交才播音效与飘字，飘字落在立绘上方而不是按钮上，视线跟着宠物走。 */
export function playFeedback(
  host: Node,
  action: HabitatAction,
  visual: PetVisual,
  outcome: HabitatOutcome,
  notify: (text: string) => void,
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
  if (action === 'pet') {
    playRock(visual.contentNode);
  }
}

/** 一次性 ±4° 摇摆：借用行为层的幅度上限，但不像 recover 那样无限循环。 */
function playRock(content: Node | null): void {
  if (!content || Quality.low) {
    return;
  }
  Tween.stopAllByTarget(content);
  content.angle = 0;
  tween(content)
    .to(0.12, { angle: -ROCK_ANGLE })
    .to(0.12, { angle: ROCK_ANGLE })
    .to(0.12, { angle: -ROCK_ANGLE })
    .to(0.12, { angle: 0 })
    .start();
}
