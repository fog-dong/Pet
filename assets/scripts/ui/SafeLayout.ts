// STATUS: implemented, W9-9 安全区布局工具（引擎 SafeArea 依赖同节点 Widget，缺 Widget 时 updateArea 直接 return）
import { Node, SafeArea, UITransform, Widget } from 'cc';

/**
 * 把节点按四边铺进父级的安全区。
 * SafeArea.updateArea() 会覆写 Widget 的四边偏移为安全区 inset，所以必须先有一个四边对齐的 Widget，
 * 否则引擎在拿不到 Widget 时静默返回，避让完全不生效。
 */
export function attachSafeArea(node: Node): void {
  if (!node.getComponent(UITransform)) {
    node.addComponent(UITransform);
  }
  const widget = node.getComponent(Widget) ?? node.addComponent(Widget);
  widget.isAlignLeft = true;
  widget.isAlignRight = true;
  widget.isAlignTop = true;
  widget.isAlignBottom = true;
  widget.left = 0;
  widget.right = 0;
  widget.top = 0;
  widget.bottom = 0;
  node.addComponent(SafeArea).updateArea();
}

/** 贴安全区底边 margin 像素、横向居中（可偏移 x）；ALWAYS 模式保证转屏与 resize 后重算。 */
export function alignBottom(node: Node, margin: number, x = 0): void {
  const widget = node.getComponent(Widget) ?? node.addComponent(Widget);
  widget.isAlignBottom = true;
  widget.isAlignHorizontalCenter = true;
  widget.bottom = margin;
  widget.horizontalCenter = x;
  widget.alignMode = Widget.AlignMode.ALWAYS;
}
