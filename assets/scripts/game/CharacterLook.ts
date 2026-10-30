// STATUS: implemented, W16 角色心情与色调（贴图渲染后的统一色调控制）
import { Color } from 'cc';

export type CharacterMood = 'idle' | 'sick' | 'recovered';

export const MOOD_ICON: Record<CharacterMood, string> = { idle: '●', sick: '✚', recovered: '♥' };

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
