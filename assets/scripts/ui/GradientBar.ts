// STATUS: implemented, W16 好感度渐变条（暖粉两色分段填充，圆角轨道 + 右侧端帽）
import { Color, Graphics, Node, UITransform } from 'cc';

const SEGMENTS = 14;
const TRACK = new Color(239, 231, 220, 255);

function lerpColor(from: Color, to: Color, t: number): Color {
  return new Color(
    Math.round(from.r + (to.r - from.r) * t),
    Math.round(from.g + (to.g - from.g) * t),
    Math.round(from.b + (to.b - from.b) * t),
    255,
  );
}

/**
 * 返回重绘函数（入参 0-1）。轨道圆角，填充拆成 SEGMENTS 段做渐变色，
 * 段数固定，宽度变化时只是每段变窄，不会重建节点。
 */
export function addGradientBar(
  parent: Node,
  name: string,
  y: number,
  width: number,
  height: number,
  x = 0,
): (ratio: number) => void {
  const track = new Node(`${name}Track`);
  track.parent = parent;
  track.setPosition(x, y, 0);
  track.addComponent(UITransform).setContentSize(width, height);
  const back = track.addComponent(Graphics);
  back.fillColor = TRACK;
  back.roundRect(-width / 2, -height / 2, width, height, height / 2);
  back.fill();

  const fill = new Node(`${name}Fill`);
  fill.parent = track;
  fill.addComponent(UITransform).setContentSize(width, height);
  const graphics = fill.addComponent(Graphics);
  const from = new Color(246, 195, 180, 255);
  const to = new Color(229, 139, 132, 255);
  const inset = 3;
  const innerH = height - inset * 2;
  const innerW = width - inset * 2;
  return (ratio: number): void => {
    const clamped = Math.max(0, Math.min(1, ratio));
    graphics.clear();
    if (clamped <= 0) {
      return;
    }
    const step = (innerW / SEGMENTS) * clamped;
    for (let i = 0; i < SEGMENTS; i += 1) {
      const color = lerpColor(from, to, i / (SEGMENTS - 1));
      graphics.fillColor = color;
      graphics.rect(-innerW / 2 + i * step, -innerH / 2, step + 0.5, innerH);
      graphics.fill();
    }
    // 右端帽：把最后一段画成半圆，避免进度条看着被切平。
    graphics.fillColor = to;
    graphics.circle(-innerW / 2 + step * SEGMENTS - innerH / 2, 0, innerH / 2);
    graphics.fill();
  };
}
