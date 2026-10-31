// STATUS: implemented, W16 P0 统一按钮（九宫格底 + 软投影 + 按下 0.95 回弹 + 禁用态，无贴图自动降级）
import { Button, Color, Label, Node, Tween, tween, UITransform, Vec3 } from 'cc';
import { makeLabel, centerLabel } from './FontKit';
import { addShadow, createBox, paintRound, sliceNode } from './PanelKit';
import { COLORS, DURATION, RADIUS } from './Tokens';

export interface UIButtonOptions {
  y: number;
  x?: number;
  width?: number;
  height?: number;
  color?: Color;
  fontSize?: number;
  radius?: number;
}

const baseColors = new Map<Node, Color>();
const pressed = new WeakSet<Node>();
const decorated = new WeakSet<Node>();

export function addUIButton(
  parent: Node,
  name: string,
  text: string,
  onClick: () => void,
  options: UIButtonOptions,
): Button {
  const button = createButton(parent, name, text, options);
  button.node.on(Button.EventType.CLICK, onClick);
  return button;
}

/** 场景里已有空按钮（Lobby 的 Start）复用它，不重新创建节点。 */
export function decorateButton(button: Button, text: string, options: UIButtonOptions): Button {
  const node = button.node;
  const width = options.width ?? node.getComponent(UITransform)?.contentSize.width ?? 420;
  const height = options.height ?? node.getComponent(UITransform)?.contentSize.height ?? 100;
  node.getComponent(UITransform)?.setContentSize(width, height);
  node.setPosition(options.x ?? 0, options.y, 0);
  const label = node.children.map((child) => child.getComponent(Label)).find((item): item is Label => !!item);
  if (label) {
    label.string = text;
    label.fontSize = options.fontSize ?? 34;
    label.color = COLORS.white;
    centerLabel(label, width - 24, height - 16);
  } else {
    const created = makeLabel(node, `${node.name}Label`, text, 0, {
      size: options.fontSize ?? 34,
      color: COLORS.white,
    });
    centerLabel(created, width - 24, height - 16);
  }
  if (!decorated.has(node) && node.parent) {
    decorated.add(node);
    addShadow(node.parent, node, width, height, options.radius ?? RADIUS.button, 4, 52);
  }
  paint(button, options);
  bindPress(node);
  return button;
}

function createButton(parent: Node, name: string, text: string, options: UIButtonOptions): Button {
  const width = options.width ?? 340;
  const height = options.height ?? 86;
  const node = createBox(parent, name, options.y, width, height, options.x ?? 0);
  const color = options.color ?? COLORS.clay;
  baseColors.set(node, color);
  addShadow(parent, node, width, height, options.radius ?? RADIUS.button, 4, 52);
  const button = node.addComponent(Button);
  button.transition = Button.Transition.NONE;
  const label = makeLabel(node, `${name}Label`, text, 0, {
    size: options.fontSize ?? 30,
    width: width - 24,
    color: COLORS.white,
  });
  centerLabel(label, width - 24, height - 16);
  bindPress(node);
  paint(button, options);
  return button;
}

/** 画底：先 Graphics 兜底，再异步换九宫格；两张贴图共享，颜色靠 tint 区分。 */
function paint(button: Button, options: UIButtonOptions): void {
  const node = button.node;
  const size = node.getComponent(UITransform)?.contentSize;
  const width = size?.width ?? 340;
  const height = size?.height ?? 86;
  const radius = options.radius ?? RADIUS.button;
  const color = button.interactable ? baseColors.get(node) ?? options.color ?? COLORS.clay : COLORS.disabled;
  paintRound(node, width, height, radius, color);
  sliceNode(node, 'ui_btn_neutral', color);
}

function bindPress(node: Node): void {
  if (pressed.has(node)) {
    return;
  }
  pressed.add(node);
  node.on(Node.EventType.TOUCH_START, () => {
    if (!node.getComponent(Button)?.interactable) {
      return;
    }
    Tween.stopAllByTarget(node);
    tween(node).to(DURATION.press, { scale: new Vec3(0.95, 0.95, 1) }).start();
  });
  const release = (): void => {
    if (!node.isValid) {
      return;
    }
    Tween.stopAllByTarget(node);
    tween(node)
      .to(DURATION.release, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
      .start();
  };
  node.on(Node.EventType.TOUCH_END, release);
  node.on(Node.EventType.TOUCH_CANCEL, release);
}

/** 置灰或恢复：广告用尽时不可点，文案同步说明原因。 */
export function setUIButtonState(button: Button, enabled: boolean, text?: string, color?: Color): void {
  button.interactable = enabled;
  const node = button.node;
  if (color) {
    baseColors.set(node, color);
  }
  const label = node.getChildByName(`${node.name}Label`)?.getComponent(Label);
  if (label) {
    if (text) {
      label.string = text;
    }
    label.color = enabled ? COLORS.white : COLORS.disabledText;
  }
  paint(button, { y: node.position.y });
}
