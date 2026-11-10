// STATUS: implemented, W20-1 M3 错峰入场（透明度淡入 + 14px 轻浮落位，Quality.low 直接落终态）
import { Node, Tween, UIOpacity, Vec3, tween } from 'cc';
import type { TweenEasing } from 'cc';
import { Quality } from '../config/Quality';
import { DURATION } from './Tokens';

const RISE = 14;
const STAGGER = 0.06;

/** 入场未完的节点停在半路会被 UIButton 当成家位置，这里留一份真实坐标用于归位。 */
const homes = new Map<Node, Vec3>();

export interface StaggerOptions {
  /** 默认走 DURATION.card；散步带这类「回到大厅」的入场用 DURATION.bandIn 长一档。 */
  duration?: number;
  easing?: TweenEasing;
}

/** 相邻 60ms、每枚 0.24s；三枚一行总编排 0.48s，入场即结束，不留在屏上循环。 */
export function playStaggerIn(nodes: readonly Node[], options: StaggerOptions = {}): void {
  if (Quality.low) {
    return;
  }
  const duration = options.duration ?? DURATION.card;
  const easing = options.easing ?? 'quadOut';
  nodes.forEach((node, index) => {
    withShadow(node).forEach((item) => enter(item, index * STAGGER, duration, easing));
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

function enter(node: Node, delay: number, duration: number, easing: TweenEasing): void {
  const home = node.position.clone();
  homes.set(node, home);
  node.setPosition(home.x, home.y - RISE, 0);
  fadeTo(node, 0);
  tween(node)
    .delay(delay)
    .to(duration, { position: new Vec3(home.x, home.y, 0) }, { easing })
    .call(() => homes.delete(node))
    .start();
  const opacity = node.getComponent(UIOpacity);
  if (opacity) {
    tween(opacity).delay(delay).to(duration, { opacity: 255 }).start();
  }
}

/**
 * 抚摸 Q 弹：压扁 → 回弹过头 → 收住（Playful 签名段，方案 §4.3 ①）。
 * dirX 取触点相对立绘中心的左右符号，让形变顺着手指方向；低端机退化为轻微上下起伏。
 * 连点同一目标时先收敛所有 tween，否则 scale 会叠在半空。
 */
export function squash(node: Node | null, dirX = 0): void {
  if (!node) {
    return;
  }
  Tween.stopAllByTarget(node);
  node.setScale(1, 1, 1);
  if (Quality.low) {
    playRock(node);
    return;
  }
  const lean = Math.max(-1, Math.min(1, dirX));
  const flat = new Vec3(1 + 0.14 * (1 - Math.abs(lean) * 0.3), 0.86, 1);
  const over = new Vec3(0.96, 1.06, 1);
  tween(node)
    .to(DURATION.squashIn, { scale: flat }, { easing: 'quadOut' })
    .to(DURATION.squashOut * 0.4, { scale: over }, { easing: 'quadOut' })
    .to(DURATION.squashOut * 0.6, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
    .call(() => node.setScale(1, 1, 1))
    .start();
  if (Math.abs(lean) > 0.15) {
    tween(node)
      .by(DURATION.squashIn, { position: new Vec3(lean * 8, 0, 0) }, { easing: 'quadOut' })
      .by(DURATION.squashOut, { position: new Vec3(-lean * 8, 0, 0) }, { easing: 'backOut' })
      .start();
  }
}

/** 咀嚼：到位后两次小幅上下脉冲，间隔由 DURATION.chew 控制。 */
export function chew(node: Node | null): void {
  if (!node || Quality.low) {
    return;
  }
  Tween.stopAllByTarget(node);
  node.setScale(1, 1, 1);
  const bite = new Vec3(1.06, 0.94, 1);
  tween(node)
    .to(DURATION.chew, { scale: bite }, { easing: 'sineInOut' })
    .to(DURATION.chew, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' })
    .to(DURATION.chew, { scale: bite }, { easing: 'sineInOut' })
    .to(DURATION.chew, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' })
    .call(() => node.setScale(1, 1, 1))
    .start();
}

/** 洗澡等轻反馈：整只立绘一缩一放，不做位移，避免和泡泡抢视线。 */
export function nudge(node: Node | null): void {
  if (!node || Quality.low) {
    return;
  }
  Tween.stopAllByTarget(node);
  node.setScale(1, 1, 1);
  tween(node)
    .to(DURATION.bathNudge * 0.5, { scale: new Vec3(0.98, 1.02, 1) }, { easing: 'sineInOut' })
    .to(DURATION.bathNudge * 0.5, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
    .call(() => node.setScale(1, 1, 1))
    .start();
}

/** 低端机兜底：±4° 一次性摇摆（原 HabitatFeedback.playRock 的口径）。 */
function playRock(node: Node): void {
  node.angle = 0;
  tween(node)
    .to(0.12, { angle: -4 })
    .to(0.12, { angle: 4 })
    .to(0.12, { angle: -4 })
    .to(0.12, { angle: 0 })
    .start();
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
