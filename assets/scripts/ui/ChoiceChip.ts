// STATUS: implemented, W27 P3-UI 选项胶囊外观（未选白纸卡 + 轻投影 / 选中主色粗描边 + 双层外发光 + 底部厚度）
import { Color, Graphics, Label, Node } from 'cc';
import { COLORS, HEX, tint } from './Tokens';

const RADIUS = 20;
const BORDER = new Color(224, 212, 196, 255);
/** 选中态三件套：外发光两档 + 比主色深一档的粗描边，靠描边而不是只换底色。 */
const GLOW_OUTER = tint(HEX.clay, 28);
const GLOW_INNER = tint(HEX.clay, 64);
const ACTIVE_FILL = tint(HEX.clay);
const ACTIVE_BORDER = tint('#B0654C');
const ACTIVE_RING = new Color(255, 255, 255, 210);
const SHADOW = new Color(62, 50, 42, 30);
const UNSELECTED_BOTTOM = tint(HEX.skirt, 70);

export function paintChip(node: Node, width: number, height: number, active: boolean): void {
  const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics);
  graphics.clear();
  const x = -width / 2;
  const y = -height / 2;
  if (active) {
    graphics.fillColor = GLOW_OUTER;
    graphics.roundRect(x - 10, y - 10, width + 20, height + 20, RADIUS + 10);
    graphics.fill();
    graphics.fillColor = GLOW_INNER;
    graphics.roundRect(x - 5, y - 5, width + 10, height + 10, RADIUS + 5);
    graphics.fill();
  } else {
    graphics.fillColor = SHADOW;
    graphics.roundRect(x, y - 4, width, height, RADIUS);
    graphics.fill();
  }
  graphics.fillColor = active ? ACTIVE_FILL : COLORS.paper;
  graphics.roundRect(x, y, width, height, RADIUS);
  graphics.fill();
  // 底部一条同色系暗边，把色块读成有厚度的按键而不是平面矩形。
  graphics.fillColor = active ? ACTIVE_BORDER : UNSELECTED_BOTTOM;
  graphics.roundRect(x + 4, y + 3, width - 8, 5, 3);
  graphics.fill();
  graphics.lineWidth = active ? 5 : 2;
  graphics.strokeColor = active ? ACTIVE_BORDER : BORDER;
  graphics.roundRect(x, y, width, height, RADIUS);
  graphics.stroke();
  if (active) {
    graphics.lineWidth = 2;
    graphics.strokeColor = ACTIVE_RING;
    graphics.roundRect(x + 5, y + 5, width - 10, height - 10, RADIUS - 5);
    graphics.stroke();
  }
}

/** 文字严格 Center/Center；选中加粗转白，未选保持深墨（纸卡上灰棕小字读起来像禁用）。 */
export function styleLabel(label: Label, active: boolean): void {
  label.color = active ? COLORS.white : COLORS.ink;
  label.isBold = active;
  label.horizontalAlign = Label.HorizontalAlign.CENTER;
  label.verticalAlign = Label.VerticalAlign.CENTER;
  label.overflow = Label.Overflow.SHRINK;
}
