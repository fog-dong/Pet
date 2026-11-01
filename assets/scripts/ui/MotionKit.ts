// STATUS: implemented, W20-1 M3 错峰入场（透明度淡入 + 14px 轻浮落位，Quality.low 直接落终态）
import { Node, Tween, UIOpacity, Vec3, tween } from 'cc';
import { Quality } from '../config/Quality';
import { DURATION } from './Tokens';

const RISE = 14;
const STAGGER = 0.06;

/** 入场未完的节点停在半路会被 UIButton 当成家位置，这里留一份真实坐标用于归位。 */
const homes = new Map<Node, Vec3>();

/** 相邻 60ms、每枚 0.24s；三枚一行总编排 0.48s，入场即结束，不留在屏上循环。 */
export function playStaggerIn(nodes: readonly Node[]): void {
  if (Quality.low) {
    return;
  }
  nodes.forEach((node, index) => {
    withShadow(node).forEach((item) => enter(item, index * STAGGER));
  });
}

/** 入场未完就被按下：先归位再让 UIButton 接管缩放，避免停帧后留下 14px 错位。 */
export function settleEntrance(node: Node): void {
  const home = homes.get(node);
  if (!home) {
    return;
  }
  homes.delete(node);
  Tween.stopAllByTarget(node);
  node.setPosition(home.x, home.y, 0);
  fadeTo(node, 255);
}

function enter(node: Node, delay: number): void {
  const home = node.position.clone();
  homes.set(node, home);
  node.setPosition(home.x, home.y - RISE, 0);
  fadeTo(node, 0);
  tween(node)
    .delay(delay)
    .to(DURATION.card, { position: new Vec3(home.x, home.y, 0) }, { easing: 'quadOut' })
    .call(() => homes.delete(node))
    .start();
  const opacity = node.getComponent(UIOpacity);
  if (opacity) {
    tween(opacity).delay(delay).to(DURATION.card, { opacity: 255 }).start();
  }
}

/** PanelKit 的影子是锚点的兄弟节点，不跟着淡入会在按钮落位前先露出一块暗角。 */
function withShadow(node: Node): Node[] {
  const shadow = node.parent?.children.find((child) => child.name === `${node.name}Shadow`);
  return shadow ? [node, shadow] : [node];
}

function fadeTo(node: Node, opacityValue: number): void {
  const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
  opacity.opacity = opacityValue;
}
