// STATUS: implemented, W25 P0-B 小屋互动反馈（音效 + 飘字 + 安抚提示 + Q 弹/抛物线/粒子；规格见方案 §4.3）
// 坐标口径改了：W20-2 的弹窗是独立面板，立绘位置可以写死常量；现在反馈直接落在列表卡片上，
// 立绘锚点与起飞点由触点侧按行传入，本文件不再持有任何绝对坐标。
import { Color, Node } from 'cc';
import { HabitatOutcome } from '../game/HabitatModel';
import { AILMENT_HEART_COST } from '../game/HabitatDecay';
import { HabitatAction } from '../game/HabitatRules';
import { PetVisual } from '../game/PetVisual';
import { Sfx } from '../game/Sfx';
import { floatText } from './FloatText';
import { chew, nudge, squash } from './MotionKit';
import { Point, spawnBubbles, spawnHearts, tossTo } from './ParticleKit';
import { COLORS } from './Tokens';

export const TINT: Record<HabitatAction, Color> = {
  feed: COLORS.gold,
  // 高级粮与普通喂食同属「吃」，但档位要看得出来：用深木色 sub，既不与雾蓝/陶土撞色，也撑得住白字。
  premium: COLORS.sub,
  bath: COLORS.mist,
  pet: COLORS.clay,
};

/**
 * 被拦住只说原因；成交才播音效与飘字，飘字落在立绘上方而不是按钮上，视线跟着宠物走。
 * portrait / origin 一律是 host 局部坐标：卡片在滚动容器里，遮罩在容器外，换算交给触点侧。
 */
export function playFeedback(
  host: Node,
  action: HabitatAction,
  visual: PetVisual,
  outcome: HabitatOutcome,
  notify: (text: string) => void,
  portrait: Point,
  origin?: Point,
  touchX = 0,
): void {
  if (outcome.kind === 'blocked') {
    notify(outcome.text);
    return;
  }
  const rule = outcome.rule;
  Sfx.play(rule.cue);
  floatText(host, outcome.floatText, portrait.x, portrait.y + 70, TINT[action]);
  if (outcome.soothed) {
    notify(`它有点闹脾气，顺手安抚了一下（−${AILMENT_HEART_COST} 爱心）`);
  }
  const content = visual.contentNode;
  if (action === 'pet') {
    squash(content, touchX);
    visual.pulseShadow();
    spawnHearts(host, { x: portrait.x, y: portrait.y + 30 });
  } else if (action === 'bath') {
    spawnBubbles(host, { x: portrait.x, y: portrait.y - 30 });
    nudge(content);
  } else if (origin && content) {
    tossTo(host, origin, { x: portrait.x, y: portrait.y + 10 }, action === 'premium' ? 'pellet' : 'bone', () => chew(content));
  }
}

