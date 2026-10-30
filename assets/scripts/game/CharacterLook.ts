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

function shade(color: Color, ratio: number): Color {
  return new Color(
    Math.round(color.r * ratio),
    Math.round(color.g * ratio),
    Math.round(color.b * ratio),
    255,
  );
}

/** 无美术资源时的宠物形象：耳朵 + 身体色块 + 眼睛，全部用 Graphics 画，size 为整体边长。 */
export function drawAvatar(graphics: Graphics, color: Color, shape: CharacterShape, size: number): void {
  const half = size / 2;
  const ear = shade(color, 0.86);
  graphics.clear();
  // 耳朵先画，会被身体盖住底部；只保留露在轮廓外的三角形。
  graphics.fillColor = ear;
  graphics.moveTo(-half * 0.78, half * 0.5);
  graphics.lineTo(-half * 0.5, half * 1.1);
  graphics.lineTo(-half * 0.16, half * 0.72);
  graphics.close();
  graphics.fill();
  graphics.moveTo(half * 0.78, half * 0.5);
  graphics.lineTo(half * 0.5, half * 1.1);
  graphics.lineTo(half * 0.16, half * 0.72);
  graphics.close();
  graphics.fill();
  graphics.fillColor = color;
  if (shape === 'square') {
    graphics.rect(-half, -half * 0.9, size, size * 0.9);
  } else {
    graphics.circle(0, 0, half);
  }
  graphics.fill();
  graphics.fillColor = shade(color, 0.4);
  const eye = Math.max(3, size * 0.055);
  graphics.circle(-half * 0.32, half * 0.1, eye);
  graphics.fill();
  graphics.circle(half * 0.32, half * 0.1, eye);
  graphics.fill();
}
