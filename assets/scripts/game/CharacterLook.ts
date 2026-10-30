// STATUS: implemented, W7 角色色块与配色（从 CharacterView 拆出，控制单文件行数）
import { Color, Graphics } from 'cc';

export type CharacterMood = 'idle' | 'sick' | 'recovered';
export type CharacterShape = 'circle' | 'square';

export const BODY_SIZE = 150;
export const FALLBACK_COLOR = new Color(200, 195, 188, 255);
export const MOOD_ICON: Record<CharacterMood, string> = { idle: '●', sick: '✚', recovered: '♥' };

export function mixColor(from: Color, to: Color, ratio: number): Color {
  const t = Math.max(0, Math.min(1, ratio));
  return new Color(
    Math.round(from.r + (to.r - from.r) * t),
    Math.round(from.g + (to.g - from.g) * t),
    Math.round(from.b + (to.b - from.b) * t),
    255,
  );
}

export function drawBody(graphics: Graphics, color: Color, shape: CharacterShape): void {
  graphics.clear();
  graphics.fillColor = color;
  if (shape === 'square') {
    graphics.rect(-BODY_SIZE / 2, -BODY_SIZE / 2, BODY_SIZE, BODY_SIZE);
  } else {
    graphics.circle(0, 0, BODY_SIZE / 2);
  }
  graphics.fill();
}
