// STATUS: implemented, W18 选项卡片外观（未选白底灰字 / 选中陶土橙 + 白粗字 + 外发光）
import { Color, Graphics, Label, Node } from 'cc';
import { COLORS } from './Tokens';

const RADIUS = 18;
const BORDER = new Color(224, 212, 196, 255);
const GLOW = new Color(217, 142, 115, 64);
const WHITE_BORDER = new Color(255, 255, 255, 232);

export function paintChip(node: Node, width: number, height: number, active: boolean): void {
  const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics);
  graphics.clear();
  if (active) {
    // 外发光先铺一层放大的半透明陶土块，再压主色与白描边。
    graphics.fillColor = GLOW;
    graphics.roundRect(-width / 2 - 7, -height / 2 - 7, width + 14, height + 14, RADIUS + 7);
    graphics.fill();
  }
  graphics.fillColor = active ? COLORS.clay : new Color(255, 255, 255, 255);
  graphics.roundRect(-width / 2, -height / 2, width, height, RADIUS);
  graphics.fill();
  graphics.lineWidth = active ? 3 : 2;
  graphics.strokeColor = active ? WHITE_BORDER : BORDER;
  graphics.roundRect(-width / 2, -height / 2, width, height, RADIUS);
  graphics.stroke();
}

/** 文字严格 Center/Center；选中加粗并转白。 */
export function styleLabel(label: Label, active: boolean): void {
  label.color = active ? COLORS.white : COLORS.sub;
  label.isBold = active;
  label.horizontalAlign = Label.HorizontalAlign.CENTER;
  label.verticalAlign = Label.VerticalAlign.CENTER;
  label.overflow = Label.Overflow.SHRINK;
}
