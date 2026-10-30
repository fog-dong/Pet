// STATUS: implemented, W16 P0 星级逐颗弹出（0→1.2→1，间隔 140ms；low 档直接落位）
import { Node, tween, Vec3 } from 'cc';
import { Quality } from '../config/Quality';
import { makeLabel } from './FontKit';
import { COLORS, DURATION, HEX, tint } from './Tokens';

export interface StarOptions {
  size?: number;
  gap?: number;
}

/** 三颗星：亮的用金色，未拿到的用浅木色，避免灰块突兀。 */
export function showStars(parent: Node, stars: number, y: number, options: StarOptions = {}): Promise<void> {
  const size = options.size ?? 64;
  const gap = options.gap ?? size + 16;
  const count = 3;
  const scored = Math.max(0, Math.min(count, Math.round(stars)));
  const nodes: Node[] = [];
  for (let i = 0; i < count; i++) {
    const filled = i < scored;
    const label = makeLabel(parent, `Star${i}`, filled ? '★' : '☆', y, {
      size,
      width: size + 24,
      x: (i - (count - 1) / 2) * gap,
      color: filled ? COLORS.gold : tint(HEX.skirt),
    });
    nodes.push(label.node);
    if (!filled) {
      continue;
    }
    if (Quality.low) {
      continue;
    }
    label.node.setScale(new Vec3(0.2, 0.2, 1));
  }
  if (Quality.low) {
    return Promise.resolve();
  }
  const filledNodes = nodes.filter((_, index) => index < scored);
  if (!filledNodes.length) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    filledNodes.forEach((node, index) => {
      tween(node)
        .delay(index * DURATION.starStep)
        .to(0.18, { scale: new Vec3(1.2, 1.2, 1) }, { easing: 'backOut' })
        .to(0.08, { scale: new Vec3(1, 1, 1) })
        .call(() => {
          if (index === filledNodes.length - 1) {
            resolve();
          }
        })
        .start();
    });
  });
}
