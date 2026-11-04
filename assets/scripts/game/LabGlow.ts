// STATUS: implemented, W25 P1-B-3 化验配对发光反馈（卡外绿光扩散淡出 + 卡片轻弹）
import { Color, Graphics, Tween, tween, UIOpacity, Vec3 } from 'cc';
import type { LabCard } from './LabView';
import { LAB_ITEM_H, LAB_ITEM_W } from './LabView';
import { addRect } from '../ui/SceneUI';

const CLEAR = new Color(0, 0, 0, 0);
const GLOW = new Color(126, 232, 148, 255);
const PAD = 26;

export function glowCard(card: LabCard): void {
  const parent = card.node.parent;
  if (!parent) {
    return;
  }
  const { x, y } = card.node.position;
  const width = LAB_ITEM_W + PAD;
  const height = LAB_ITEM_H + PAD;
  const node = addRect(parent, 'LabGlow', y, width, height, CLEAR, x);
  const graphics = node.getComponent(Graphics);
  if (graphics) {
    graphics.strokeColor = GLOW;
    graphics.lineWidth = 5;
    graphics.roundRect(-width / 2, -height / 2, width, height, 12);
    graphics.stroke();
  }
  // 绿光压在卡片下面，卡片文字不被盖住。
  node.setSiblingIndex(Math.max(0, card.node.getSiblingIndex()));
  const opacity = node.addComponent(UIOpacity);
  opacity.opacity = 0;
  node.setScale(0.94, 0.94, 1);
  tween(node).to(0.14, { scale: new Vec3(1.06, 1.06, 1) }, { easing: 'backOut' }).start();
  tween(opacity)
    .to(0.1, { opacity: 255 })
    .delay(0.16)
    .to(0.26, { opacity: 0 })
    .call(() => node.destroy())
    .start();
  Tween.stopAllByTarget(card.node);
  card.node.setScale(Vec3.ONE);
  tween(card.node)
    .to(0.09, { scale: new Vec3(1.05, 1.05, 1) })
    .to(0.12, { scale: Vec3.ONE })
    .start();
}
