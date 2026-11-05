// STATUS: implemented, W27 P3-UI 图标胶囊行（左图标圆片 + 右文字、按压反馈、选中 Q 弹；行头改主色竖条 + 名称）
import { Graphics, Label, Node, Tween, tween, UITransform, Vec3 } from 'cc';
import { makeLabel } from './FontKit';
import { GlyphKind, addGlyphBadge, paintGlyphBadge } from './GlyphKit';
import { COLORS, DURATION, tint } from './Tokens';
import { bindPressEffect } from './UIButton';
import { paintChip, styleLabel } from './ChoiceChip';

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
  /** 胶囊左侧图标；不传即纯文字胶囊。 */
  icon?: GlyphKind;
  width?: number;
  height?: number;
  onClick: (value: string) => void;
}

const DEFAULT_H = 84;
const BADGE = 38;
/** 图标圆片左边距 12，文字区从圆片右侧 10px 起，末尾留 12px 呼吸。 */
const BADGE_INSET = 12;
const BADGE_IDLE = tint('#F6E3DA');
const BADGE_ACTIVE = tint('#B0654C');
/** 文字区中心：左边界 -w/2+62、右边界 w/2-12，中点固定在 +24，与胶囊宽度无关。 */
const TEXT_SHIFT = (10 + BADGE) / 2;

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
    if (opts.icon) {
      const badge = addGlyphBadge(node, `${name}Badge`, opts.icon, BADGE, BADGE_IDLE, COLORS.clay);
      badge.setPosition(-width / 2 + BADGE_INSET + BADGE / 2, 0, 0);
    }
    const label = addChipLabel(node, name, value, width, height, !!opts.icon);
    bindPressEffect(node);
    node.on(Node.EventType.TOUCH_END, () => opts.onClick(value));
    return { value, node, label, selected: false };
  });
}

/** 带图标的胶囊把文字区整体右移，避免压到圆片上。 */
function addChipLabel(node: Node, name: string, value: string, width: number, height: number, hasIcon: boolean): Label {
  const row = new Node(`${name}Label`);
  row.parent = node;
  const textW = hasIcon ? Math.max(60, width - BADGE_INSET * 2 - BADGE - 10) : width - 16;
  row.setPosition(hasIcon ? TEXT_SHIFT : 0, 0, 0);
  const transform = row.addComponent(UITransform);
  transform.setContentSize(textW, height);
  const label = row.addComponent(Label);
  label.string = value;
  label.fontSize = width >= 150 ? 21 : 19;
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
    repaintBadge(choice.node, active);
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

/** 选中后图标反白：圆片转成深一档主色底，图标本体走白色才压得住主色。 */
function repaintBadge(node: Node, active: boolean): void {
  const badge = node.children.find((child) => child.name.endsWith('Badge'));
  if (badge) {
    paintGlyphBadge(badge, active ? BADGE_ACTIVE : BADGE_IDLE, active ? COLORS.white : COLORS.clay);
  }
}

function bounce(node: Node): void {
  Tween.stopAllByTarget(node);
  node.setScale(1, 1, 1);
  tween(node)
    .to(DURATION.press, { scale: new Vec3(1.05, 1.05, 1) }, { easing: 'quadOut' })
    .to(DURATION.release, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
    .start();
}

/** 行头：一条主色竖条 + 名称，图标已经进了胶囊，这里不再画第二枚圆图。 */
export function addRowHeader(parent: Node, name: string, y: number, x: number): void {
  const node = new Node(`Header_${name}`);
  node.parent = parent;
  node.setPosition(x, y, 0);
  node.addComponent(UITransform).setContentSize(96, DEFAULT_H);
  const graphics = node.addComponent(Graphics);
  graphics.fillColor = COLORS.clay;
  graphics.roundRect(-48, -22, 6, 44, 3);
  graphics.fill();
  makeLabel(node, `${name}Label`, name, 0, {
    size: 26,
    width: 82,
    x: 6,
    color: COLORS.ink,
  });
}
