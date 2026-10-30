// STATUS: implemented, W16 P0 飘字（+84 金币 上浮 120px 渐隐 0.9s，多条自动错位）
import { Color, Node, tween, UIOpacity, Vec3 } from 'cc';
import { Quality } from '../config/Quality';
import { makeLabel } from './FontKit';
import { COLORS, DURATION } from './Tokens';

let slot = 0;

export function floatText(
  parent: Node,
  text: string,
  x: number,
  y: number,
  color: Color = COLORS.gold,
): Node {
  const offset = Quality.low ? 0 : (slot++ % 3) * 34;
  const label = makeLabel(parent, 'FloatText', text, y + offset, {
    size: 30,
    color,
    width: 320,
    x,
  });
  const node = label.node;
  if (Quality.low) {
    tween(node)
      .delay(0.6)
      .call(() => node.destroy())
      .start();
    return node;
  }
  const opacity = node.addComponent(UIOpacity);
  tween(node)
    .to(DURATION.float, { position: new Vec3(x, y + offset + 120, 0) }, { easing: 'sineOut' })
    .start();
  tween(opacity)
    .to(DURATION.float, { opacity: 0 }, { easing: 'sineOut' })
    .call(() => {
      if (node.isValid) {
        node.destroy();
      }
    })
    .start();
  return node;
}
