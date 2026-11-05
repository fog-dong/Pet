// STATUS: implemented, W27 P3-UI 图标入口（形状库调度 + 图标圆片；画法本体在 GlyphShapes.ts）
import { Color, Graphics, Node, UITransform } from 'cc';
import { COLORS } from './Tokens';
import { GLYPH_SHAPES, GlyphKind } from './GlyphShapes';

export type { GlyphKind };

/** 以 (x, y) 为中心画一枚 size 见方的图标：线宽随 size 缩放，缩到 24 也不断笔。 */
export function drawGlyph(g: Graphics, kind: GlyphKind, x: number, y: number, size: number, color: Color): void {
  g.lineWidth = Math.max(2, size * 0.1);
  g.strokeColor = color;
  g.fillColor = color;
  GLYPH_SHAPES[kind](g, x, y, size / 2, color);
}

const badges = new WeakMap<Node, { kind: GlyphKind; size: number }>();

/**
 * 重画一枚图标圆片：底色与图标色分开给，选中态只要换成「深底 + 白图标」。
 * 盘和图标分两个 Graphics，否则清盘会把图标一起擦掉。
 */
export function paintGlyphBadge(badge: Node, fill: Color, icon: Color): void {
  const spec = badges.get(badge);
  if (!spec) {
    return;
  }
  const disc = badge.getComponent(Graphics);
  const glyph = badge.children.find((child) => child.name === 'Glyph')?.getComponent(Graphics);
  if (!disc || !glyph) {
    return;
  }
  disc.clear();
  disc.fillColor = fill;
  disc.circle(0, 0, spec.size / 2);
  disc.fill();
  glyph.clear();
  drawGlyph(glyph, spec.kind, 0, 0, spec.size * 0.62, icon);
}

/** 图标圆片：治疗胶囊左侧、方案纸卡每格开头都用它。 */
export function addGlyphBadge(
  parent: Node,
  name: string,
  kind: GlyphKind,
  size: number,
  fill: Color,
  icon: Color,
): Node {
  const node = new Node(name);
  node.parent = parent;
  node.addComponent(UITransform).setContentSize(size, size);
  node.addComponent(Graphics);
  const glyph = new Node('Glyph');
  glyph.parent = node;
  glyph.addComponent(UITransform).setContentSize(size, size);
  glyph.addComponent(Graphics);
  badges.set(node, { kind, size });
  paintGlyphBadge(node, fill, icon);
  return node;
}

/** 纯透明底图标（成就卡片角标、称号条点缀），不需要圆片时用它。 */
export function addGlyphNode(parent: Node, name: string, kind: GlyphKind, size: number, color = COLORS.ink): Node {
  const node = new Node(name);
  node.parent = parent;
  node.addComponent(UITransform).setContentSize(size, size);
  drawGlyph(node.addComponent(Graphics), kind, 0, 0, size, color);
  return node;
}
