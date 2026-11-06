// STATUS: implemented, W27 P3-UI 给已有 UIButton 挂左侧动作图标（不动 UIButton 本体，避免全站按钮回归）
import { Button, Graphics, Node, UITransform } from 'cc';
import { GlyphKind, drawGlyph } from './GlyphKit';
import { COLORS } from './Tokens';

/** 图标左边距 / 图标与文字间距 / 文字区右边距；三者共同决定文字整体的中心偏移。 */
const INSET = 12;
const GAP = 8;
const RIGHT = 10;

const painted = new WeakMap<Node, string>();

/**
 * 图标必须画在按钮的子节点上：置灰与换色都会重画按钮自身的 Graphics，
 * 同一张 Graphics 会被 clear() 抹掉。文字中心 = (size + GAP + RIGHT - INSET) / 2。
 */
export function attachButtonIcon(button: Button, kind: GlyphKind, enabled = true, size = 24): void {
  const node = button.node;
  const width = node.getComponent(UITransform)?.contentSize.width ?? 150;
  const name = `${node.name}Icon`;
  let icon = node.getChildByName(name);
  if (!icon) {
    icon = new Node(name);
    icon.parent = node;
    icon.addComponent(UITransform).setContentSize(size, size);
    icon.addComponent(Graphics);
  }
  icon.setPosition(-width / 2 + INSET + size / 2, 0, 0);
  shiftLabel(node, `${node.name}Label`, width, size);
  const key = `${kind}:${enabled}`;
  if (painted.get(icon) === key) {
    return;
  }
  painted.set(icon, key);
  const graphics = icon.getComponent(Graphics);
  if (!graphics) {
    return;
  }
  graphics.clear();
  drawGlyph(graphics, kind, 0, 0, size, enabled ? COLORS.white : COLORS.disabledText);
}

/** 文字区让出图标位：重新定宽再平移，SHRINK 模式下长文案只会缩字不会压到图标。 */
function shiftLabel(node: Node, labelName: string, width: number, size: number): void {
  const labelNode = node.getChildByName(labelName);
  const box = labelNode?.getComponent(UITransform);
  if (!labelNode || !box) {
    return;
  }
  box.setContentSize(Math.max(40, width - INSET - size - GAP - RIGHT), box.height);
  labelNode.setPosition((size + GAP + RIGHT - INSET) / 2, 0, 0);
}
