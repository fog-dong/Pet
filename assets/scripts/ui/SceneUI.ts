// STATUS: implemented, W3 占位 UI 构建器（纯色 + Label，不依赖美术资源）
import { Button, Color, Graphics, Label, Node, UITransform } from 'cc';

export const PALETTE = {
  panel: new Color(255, 255, 255, 240),
  primary: new Color(238, 148, 92, 255),
  secondary: new Color(139, 168, 157, 255),
  text: new Color(74, 62, 54, 255),
  sub: new Color(122, 110, 100, 255),
  accent: new Color(226, 197, 143, 255),
};

export interface LabelOptions {
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
  const size = options.size ?? 26;
  const width = options.width ?? 960;
  const node = createNode(parent, name, y, width, size + 12);
  node.setPosition(options.x ?? 0, y, 0);
  const label = node.addComponent(Label);
  label.string = text;
  label.fontSize = size;
  label.lineHeight = Math.round(size * 1.4);
  label.color = options.color ?? PALETTE.text;
  label.horizontalAlign = Label.HorizontalAlign.CENTER;
  label.verticalAlign = Label.VerticalAlign.CENTER;
  label.overflow = Label.Overflow.RESIZE_HEIGHT;
  return label;
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
  const node = addRect(parent, name, y, width, height, color, x);
  const button = node.addComponent(Button);
  button.transition = Button.Transition.NONE;
  addLabel(node, `${name}Label`, text, 0, { size: 30, width: width - 24 }).color = new Color(
    255,
    255,
    255,
    255,
  );
  node.on(Button.EventType.CLICK, onClick);
  return button;
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
  button.interactable = enabled;
  const node = button.node;
  const size = node.getComponent(UITransform)?.contentSize;
  paintRect(node, size?.width ?? 340, size?.height ?? 86, enabled ? color : new Color(198, 190, 182, 255));
  const label = node.getChildByName(`${node.name}Label`)?.getComponent(Label);
  if (label) {
    if (text) {
      label.string = text;
    }
    label.color = enabled ? new Color(255, 255, 255, 255) : new Color(122, 114, 106, 255);
  }
}
