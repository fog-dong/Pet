// STATUS: implemented, W18 治疗选项行（等宽网格卡片 + 多选高亮 + 左侧行头图标与文字同轴对齐）
import { Color, Graphics, Label, Node, Tween, tween, UITransform, Vec3 } from 'cc';
import { makeLabel } from './FontKit';
import { COLORS } from './Tokens';
import { paintChip, styleLabel } from './ChoiceChip';

export type ChoiceIcon = 'medicine' | 'bed' | 'time';

export interface Choice {
  value: string;
  node: Node;
  label: Label;
  selected: boolean;
}

export interface ChoiceRowOptions {
  y: number;
  x0: number;
  gap: number;
  width?: number;
  height?: number;
  onClick: (value: string) => void;
}

const DEFAULT_H = 84;

export function addChoiceRow(
  parent: Node,
  prefix: string,
  options: readonly string[],
  opts: ChoiceRowOptions,
): Choice[] {
  const width = opts.width ?? 300;
  const height = opts.height ?? DEFAULT_H;
  return options.map((value, index) => {
    const name = `${prefix}${index}`;
    const node = new Node(name);
    node.parent = parent;
    node.setPosition(opts.x0 + opts.gap * index, opts.y, 0);
    node.addComponent(UITransform).setContentSize(width, height);
    paintChip(node, width, height, false);
    const label = addChipLabel(node, name, value, width, height);
    node.on(Node.EventType.TOUCH_END, () => opts.onClick(value));
    return { value, node, label, selected: false };
  });
}

function addChipLabel(node: Node, name: string, value: string, width: number, height: number): Label {
  const row = new Node(`${name}Label`);
  row.parent = node;
  row.setPosition(0, 0, 0);
  const transform = row.addComponent(UITransform);
  transform.setContentSize(width - 16, height);
  const label = row.addComponent(Label);
  label.string = value;
  label.fontSize = width >= 150 ? 26 : 21;
  label.lineHeight = Math.round(label.fontSize * 1.3);
  styleLabel(label, false);
  return label;
}

/** 多选：selected 为当前选中的一组值；用药行可传 0..n 个。 */
export function paintChoices(
  choices: readonly Choice[],
  selected: readonly string[],
  text?: (value: string) => string,
): void {
  for (const choice of choices) {
    const size = choice.node.getComponent(UITransform)?.contentSize;
    const active = selected.includes(choice.value);
    if (active && !choice.selected) {
      bounce(choice.node);
    }
    choice.selected = active;
    paintChip(choice.node, size?.width ?? 300, size?.height ?? DEFAULT_H, active);
    styleLabel(choice.label, active);
    if (text) {
      choice.label.string = text(choice.value);
    }
  }
}

function bounce(node: Node): void {
  Tween.stopAllByTarget(node);
  node.setScale(1, 1, 1);
  tween(node)
    .to(0.07, { scale: new Vec3(1.05, 1.05, 1) })
    .to(0.12, { scale: Vec3.ONE })
    .start();
}

/** 行头：图标与文字同一水平轴，三行共用同一个 x，形成左侧对齐列。 */
export function addRowHeader(parent: Node, name: string, kind: ChoiceIcon, y: number, x: number): void {
  const node = new Node(`Header_${name}`);
  node.parent = parent;
  node.setPosition(x, y, 0);
  node.addComponent(UITransform).setContentSize(168, DEFAULT_H);
  const graphics = node.addComponent(Graphics);
  const cx = -42;
  graphics.fillColor = new Color(255, 255, 255, 190);
  graphics.circle(cx, 0, 24);
  graphics.fill();
  graphics.strokeColor = COLORS.ink;
  graphics.lineWidth = 3;
  drawIcon(graphics, kind, cx);
  makeLabel(node, `${name}Label`, name, 0, {
    size: 27,
    width: 96,
    x: 20,
    color: COLORS.ink,
  });
}

function drawIcon(graphics: Graphics, kind: ChoiceIcon, cx: number): void {
  if (kind === 'medicine') {
    graphics.roundRect(cx - 16, -9, 32, 18, 9);
    graphics.stroke();
    graphics.moveTo(cx, -9);
    graphics.lineTo(cx, 9);
  } else if (kind === 'bed') {
    graphics.moveTo(cx - 17, -8);
    graphics.lineTo(cx - 17, 9);
    graphics.lineTo(cx + 17, 9);
    graphics.lineTo(cx + 17, -4);
    graphics.moveTo(cx - 17, 1);
    graphics.lineTo(cx + 17, 1);
    graphics.moveTo(cx - 10, 1);
    graphics.lineTo(cx - 10, 7);
    graphics.lineTo(cx + 2, 7);
    graphics.lineTo(cx + 2, 1);
  } else {
    graphics.circle(cx, 0, 14);
    graphics.moveTo(cx, 0);
    graphics.lineTo(cx, 8);
    graphics.moveTo(cx, 0);
    graphics.lineTo(cx + 7, -4);
  }
  graphics.stroke();
}
