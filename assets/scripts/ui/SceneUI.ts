// STATUS: implemented, W3 占位 UI 构建器（纯色 + Label，不依赖美术资源）；W16 P0 按钮/文字改由 UIButton / FontKit 渲染
import { Button, Color, Graphics, Label, Node, UITransform } from 'cc';
import { fitWidth } from './ScreenMetrics';
import { makeLabel, TextOptions } from './FontKit';
import { COLORS } from './Tokens';
import { addUIButton, setUIButtonState } from './UIButton';

/** 旧调用点仍按 PALETTE 取色；色值统一在 Tokens 里维护。 */
export const PALETTE = {
  panel: new Color(255, 252, 245, 240),
  primary: COLORS.clay,
  secondary: COLORS.sage,
  text: COLORS.ink,
  sub: COLORS.sub,
  accent: COLORS.gold,
};

export interface LabelOptions extends TextOptions {
  size?: number;
  color?: Color;
  width?: number;
  x?: number;
}

export function hexToColor(hex: string, fallback: Color = PALETTE.text): Color {
  const value = hex.replace('#', '');
  if (value.length !== 6) {
    return fallback;
  }
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return fallback;
  }
  return new Color(r, g, b, 255);
}

export function createNode(parent: Node, name: string, y: number, width: number, height: number): Node {
  const node = new Node(name);
  node.parent = parent;
  node.setPosition(0, y, 0);
  node.addComponent(UITransform).setContentSize(width, height);
  return node;
}

export function addRect(
  parent: Node,
  name: string,
  y: number,
  width: number,
  height: number,
  color: Color,
  x = 0,
): Node {
  const node = createNode(parent, name, y, width, height);
  node.setPosition(x, y, 0);
  paintRect(node, width, height, color);
  return node;
}

export function paintRect(node: Node, width: number, height: number, color: Color): Graphics {
  const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics);
  graphics.clear();
  graphics.fillColor = color;
  graphics.rect(-width / 2, -height / 2, width, height);
  graphics.fill();
  return graphics;
}

export function addLabel(
  parent: Node,
  name: string,
  text: string,
  y: number,
  options: LabelOptions = {},
): Label {
  // 720 帧下正文一列的可用宽度是 680；显式宽度仍按留白裁剪。
  const width = fitWidth(options.width ?? 640, 20);
  return makeLabel(parent, name, text, y, { ...options, width });
}

export function addButton(
  parent: Node,
  name: string,
  text: string,
  y: number,
  onClick: () => void,
  color: Color = PALETTE.primary,
  width = 340,
  height = 86,
  x = 0,
): Button {
  return addUIButton(parent, name, text, onClick, { y, x, width, height, color });
}

/** 进度条：返回重绘函数，入参 0-1。 */
export function addProgressBar(
  parent: Node,
  name: string,
  y: number,
  width: number,
  height: number,
): (ratio: number) => void {
  const back = addRect(parent, `${name}Back`, y, width, height, new Color(226, 218, 208, 255));
  const fill = new Node(`${name}Fill`);
  fill.parent = back;
  fill.setPosition(-width / 2, 0, 0);
  fill.addComponent(UITransform).setContentSize(width, height);
  const graphics = fill.addComponent(Graphics);
  return (ratio: number): void => {
    const clamped = Math.max(0, Math.min(1, ratio));
    graphics.clear();
    graphics.fillColor = PALETTE.accent;
    graphics.rect(0, -height / 2, width * clamped, height);
    graphics.fill();
  };
}

/** 置灰或恢复按钮：广告次数用尽时按钮不可点，文案同步提示原因。 */
export function setButtonState(button: Button, enabled: boolean, text?: string, color = PALETTE.secondary): void {
  setUIButtonState(button, enabled, text, color);
}
