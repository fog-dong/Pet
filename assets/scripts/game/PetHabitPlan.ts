// STATUS: implemented, W30-1 宠物习性动作抽签（纯函数，无 cc 依赖，供 PetHabits 与回归脚本共用）
// 三个动作在计划表里等量出现，抽签只决定「这一轮演哪个」，不决定幅度——幅度归 PetHabits 的常量表。

export type HabitAction = 'walk' | 'stretch' | 'lick';

/** 洗牌的是「顺序直觉」：贴近猫狗真实的懒散节奏，伸懒腰之后多半舔两下，再踱两步。 */
const PLAN: readonly HabitAction[] = ['stretch', 'lick', 'walk', 'lick', 'stretch', 'walk'];

export const HABIT_PLAN = PLAN;

/** 越界与 NaN 一律收口到第一档，调用方传 Math.random() 之外的值也不会抽出 undefined。 */
export function pickHabit(r: number): HabitAction {
  const safe = Number.isFinite(r) ? Math.min(Math.max(r, 0), 0.9999) : 0;
  return PLAN[Math.floor(safe * PLAN.length)] ?? PLAN[0];
}

/** 同一个动作连着演两遍会读成卡帧；撞上就顺延到计划表的下一条。 */
export function pickNextHabit(r: number, last: HabitAction | null): HabitAction {
  const next = pickHabit(r);
  if (next !== last) {
    return next;
  }
  return PLAN[(PLAN.indexOf(next) + 1) % PLAN.length] ?? PLAN[0];
}
