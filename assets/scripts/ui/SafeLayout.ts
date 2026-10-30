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

/** 贴安全区顶边 margin 像素、横向居中（可偏移 x）；ALWAYS 模式保证转屏与 resize 后重算。 */
export function alignTop(node: Node, margin: number, x = 0): void {
  const widget = node.getComponent(Widget) ?? node.addComponent(Widget);
  widget.isAlignTop = true;
  widget.isAlignHorizontalCenter = true;
  widget.top = margin;
  widget.horizontalCenter = x;
  widget.alignMode = Widget.AlignMode.ALWAYS;
}

/**
 * 一排贴左上角的节点：场景文件里遗留的绝对坐标（例如 -440）在 720 帧下会出屏，
 * 改挂 Widget 后随可视宽度自适应；top 为首行外边距，gap 为行距。
 */
export function pinTopLeft(nodes: readonly (Node | null)[], left: number, top: number, gap = 60): void {
  nodes.forEach((node, index) => {
    if (!node) {
      return;
    }
    pinTopLeftAt(node, left, top + index * gap);
  });
}

/** 单个节点贴安全区左上角；横向并排的 HUD 用它逐个定位。 */
export function pinTopLeftAt(node: Node, left: number, top: number): void {
  const widget = node.getComponent(Widget) ?? node.addComponent(Widget);
  widget.isAlignLeft = true;
  widget.left = left;
  widget.isAlignTop = true;
  widget.top = top;
  widget.alignMode = Widget.AlignMode.ALWAYS;
}
