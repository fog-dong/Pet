// STATUS: implemented, W16 治疗选项（圆角卡片 + 选中描边高亮 + 回弹；行头为图标 + 分组名）
import { Color, Graphics, Label, Node, Tween, tween, UITransform, Vec3 } from 'cc';
import { COLORS } from './Tokens';

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
  onClick: (value: string) => void;
}

const CARD_H = 82;
const RADIUS = 18;
const PAPER = new Color(255, 252, 245, 255);
const BORDER = new Color(217, 195, 166, 255);
const WHITE = new Color(255, 255, 255, 255);

/** 选中态：暖陶底 + 深墨描边，和未选中的纸白卡片拉开两层对比。 */
function paintChip(node: Node, width: number, height: number, active: boolean): void {
  const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics);
  graphics.clear();
  graphics.fillColor = active ? COLORS.clay : PAPER;
  graphics.roundRect(-width / 2, -height / 2, width, height, RADIUS);
  graphics.fill();
  graphics.lineWidth = active ? 4 : 2;
  graphics.strokeColor = active ? COLORS.ink : BORDER;
  graphics.roundRect(-width / 2, -height / 2, width, height, RADIUS);
  graphics.stroke();
}

export function addChoiceRow(
  parent: Node,
  prefix: string,
  options: readonly string[],
  opts: ChoiceRowOptions,
): Choice[] {
  const width = opts.width ?? 300;
  return options.map((value, index) => {
    const name = `${prefix}${index}`;
    const node = new Node(name);
    node.parent = parent;
    node.setPosition(opts.x0 + opts.gap * index, opts.y, 0);
    node.addComponent(UITransform).setContentSize(width, CARD_H);
    paintChip(node, width, CARD_H, false);
    const label = addChipLabel(node, name, value, width);
    node.on(Node.EventType.TOUCH_END, () => opts.onClick(value));
    return { value, node, label, selected: false };
  });
}

function addChipLabel(node: Node, name: string, value: string, width: number): Label {
  const row = new Node(`${name}Label`);
  row.parent = node;
  row.addComponent(UITransform).setContentSize(width - 20, CARD_H);
  // 行内文字：用 Label 组件直接挂，宽度随卡片收，四字文案在 720 帧下也不会被裁。
  const label = row.addComponent(Label);
  label.string = value;
  label.fontSize = width >= 150 ? 26 : 20;
  label.lineHeight = Math.round(label.fontSize * 1.35);
  label.overflow = Label.Overflow.SHRINK;
  label.horizontalAlign = Label.HorizontalAlign.CENTER;
  label.verticalAlign = Label.VerticalAlign.CENTER;
  label.color = COLORS.ink;
  const transform = row.getComponent(UITransform);
  transform?.setContentSize(width - 20, CARD_H);
  return label;
}

/** 重绘选中态；text 回调用于在按钮上追加库存角标。 */
export function paintChoices(
  choices: readonly Choice[],
  selected: string,
  text?: (value: string) => string,
): void {
  for (const choice of choices) {
    const size = choice.node.getComponent(UITransform)?.contentSize;
    const active = choice.value === selected;
    if (active && !choice.selected) {
      bounce(choice.node);
    }
    choice.selected = active;
    paintChip(choice.node, size?.width ?? 300, size?.height ?? CARD_H, active);
    choice.label.color = active ? WHITE : COLORS.ink;
    if (text) {
      choice.label.string = text(choice.value);
    }
  }
}

function bounce(node: Node): void {
  Tween.stopAllByTarget(node);
  node.setScale(1, 1, 1);
  tween(node)
    .to(0.07, { scale: new Vec3(1.06, 1.06, 1) })
    .to(0.12, { scale: Vec3.ONE })
    .start();
}

const ICON_BG = new Color(232, 240, 228, 255);

/** 行头：圆底图标 + 分组名，替代原来只有两字标签的裸文字。 */
export function addRowHeader(parent: Node, name: string, kind: ChoiceIcon, y: number, x: number): void {
  const node = new Node(`Header_${name}`);
  node.parent = parent;
  node.setPosition(x, y, 0);
  node.addComponent(UITransform).setContentSize(96, CARD_H);
  const graphics = node.addComponent(Graphics);
  graphics.fillColor = ICON_BG;
  graphics.circle(-14, 16, 24);
  graphics.fill();
  graphics.strokeColor = COLORS.sage;
  graphics.lineWidth = 3;
  graphics.strokeColor = COLORS.ink;
  if (kind === 'medicine') {
    graphics.roundRect(-26, 8, 24, 14, 7);
    graphics.stroke();
    graphics.moveTo(-14, 8);
    graphics.lineTo(-14, 22);
  } else if (kind === 'bed') {
    graphics.moveTo(-26, 12);
    graphics.lineTo(-26, 28);
    graphics.lineTo(-2, 28);
    graphics.lineTo(-2, 12);
    graphics.moveTo(-2, 20);
    graphics.lineTo(-6, 20);
  } else {
    graphics.circle(-14, 16, 13);
    graphics.moveTo(-14, 16);
    graphics.lineTo(-14, 24);
    graphics.moveTo(-14, 16);
    graphics.lineTo(-8, 12);
  }
  graphics.stroke();
  const label = new Node(`${name}Label`);
  label.parent = node;
  label.setPosition(0, -20, 0);
  label.addComponent(UITransform).setContentSize(96, 28);
  const text = label.addComponent(Label);
  text.string = name;
  text.fontSize = 21;
  text.lineHeight = 28;
  text.color = COLORS.sub;
  text.horizontalAlign = Label.HorizontalAlign.CENTER;
}
