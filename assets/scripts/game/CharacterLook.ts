// STATUS: implemented, W16 角色心情与色调（贴图渲染后的统一色调控制）；W17-3 心情扩展为五档行为状态
import { Color } from 'cc';

/** 行为状态机档位：待机呼吸 / 生病萎靡 / 康复摇尾 / 领养后跳跃 / 休息。 */
export type PetState = 'idle' | 'sick' | 'recover' | 'happy' | 'sleep';

export const MOOD_ICON: Record<PetState, string> = {
  idle: '●',
  sick: '✚',
  recover: '◐',
  happy: '♥',
  sleep: '☾',
};

/** 生病时把贴图压成灰调，康复后回到原色；用顶点色乘算，不重画贴图。 */
export const SICK_TINT = new Color(206, 201, 194, 255);
export const CLEAN_TINT = new Color(255, 255, 255, 255);

export function mixColor(from: Color, to: Color, ratio: number): Color {
  const t = Math.max(0, Math.min(1, ratio));
  return new Color(
    Math.round(from.r + (to.r - from.r) * t),
    Math.round(from.g + (to.g - from.g) * t),
    Math.round(from.b + (to.b - from.b) * t),
    255,
  );
}

/** 状态决定底色：sick 全灰，recover 按康复进度连续提亮，其余原色。 */
export function stateTint(state: PetState, ratio: number): Color {
  if (state === 'sick') {
    return SICK_TINT;
  }
  return state === 'recover' ? mixColor(SICK_TINT, CLEAN_TINT, ratio) : CLEAN_TINT;
}
