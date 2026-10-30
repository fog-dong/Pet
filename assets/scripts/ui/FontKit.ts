// STATUS: implemented, W16 P0 文字入口（Label 创建 + 圆体字体替换，字体未就绪时回落系统字）
import { Color, HorizontalTextAlignment, Label, Node, TTFFont, UITransform } from 'cc';
import { fitWidth } from './ScreenMetrics';
import { COLORS } from './Tokens';
import { loadUiFont } from './UiAssets';

export interface TextOptions {
  size?: number;
  color?: Color;
  width?: number;
  x?: number;
  align?: HorizontalTextAlignment;
}

const labels = new Set<Label>();
let uiFont: TTFFont | null = null;
let booting = false;

/** 预留的字体替换接口：ui 分包就绪后统一换字，失败即保持系统字。 */
export function applyUiFont(label: Label): void {
  if (uiFont) {
    label.useSystemFont = false;
    label.font = uiFont;
    return;
  }
  labels.add(label);
  if (booting) {
    return;
  }
  booting = true;
  void loadUiFont().then((font) => {
    uiFont = font;
    if (!font) {
      labels.clear();
      return;
    }
    for (const item of labels) {
      if (item.isValid) {
        item.useSystemFont = false;
        item.font = font;
      }
    }
    labels.clear();
  });
}

export function makeLabel(
  parent: Node,
  name: string,
  text: string,
  y: number,
  options: TextOptions = {},
): Label {
  const size = options.size ?? 26;
  const width = fitWidth(options.width ?? 640, 20);
  const node = new Node(name);
  node.parent = parent;
  node.setPosition(options.x ?? 0, y, 0);
  node.addComponent(UITransform).setContentSize(width, size + 12);
  const label = node.addComponent(Label);
  label.string = text;
  label.fontSize = size;
  label.lineHeight = Math.round(size * 1.4);
  label.color = options.color ?? COLORS.ink;
  label.horizontalAlign = options.align ?? Label.HorizontalAlign.CENTER;
  label.verticalAlign = Label.VerticalAlign.CENTER;
  label.overflow = Label.Overflow.RESIZE_HEIGHT;
  applyUiFont(label);
  return label;
}
