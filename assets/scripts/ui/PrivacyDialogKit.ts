// STATUS: implemented, W11-3 隐私弹窗控件（面板/正文/双按钮宽度全部按可视宽度派生，720 帧下 660/280）
import { Button, Color, Graphics, Mask, Node, ScrollView, UITransform } from 'cc';
import { LEGAL_DOCS } from '../config/LegalConfig';
import { addLabel, addRect, createNode, PALETTE } from './SceneUI';
import { fitWidth, safeAreaBottom, screenHeight } from './ScreenMetrics';

/** 面板宽度贴合可视宽度；高度受可视高度约束，短屏设备不会超出屏幕。 */
export function panelW(): number {
  return fitWidth(980, 30);
}

export function panelH(): number {
  // 640：标题 + 300 滚动区 + 勾选行 + 76 高按钮四段刚好排得下，不再互相压。
  return Math.min(640, Math.max(360, screenHeight() - 120));
}

/** 按钮统一 76 高、宽随面板收；高于 44×44 的最小可点热区。 */
export const BUTTON_H = 76;

/** 面板底部按钮到面板下沿的留白。 */
const ACTION_MARGIN = 58;

/** 面板贴安全区上方的下沿：距屏幕下沿 = 安全区底部 + 80。 */
export function panelCenterY(): number {
  return safeAreaBottom() + 80 + panelH() / 2 - screenHeight() / 2;
}

/** 底部按钮在面板局部坐标里的 y；所有弹窗共用同一口径。 */
export function actionY(): number {
  return -panelH() / 2 + ACTION_MARGIN;
}

/** 两枚按钮并排：宽度取面板半幅减 50，720 帧下 280，1280 帧下仍是 320。 */
export function dialogButtonW(): number {
  return Math.min(320, panelW() / 2 - 50);
}

/** 左右两枚按钮的中心偏移：半宽 + 30 的间隙；1280 帧下等于既有的 ±190。 */
export function buttonX(): number {
  return dialogButtonW() / 2 + 30;
}

/** 正文滚动区：加高到 300 后首屏能多显示两行，避免刚打开就被裁断。 */
const SCROLL_H = 300;
const CHARS_PER_LINE = 36;
const LINE_H = 32;

export function addDialogButton(
  parent: Node,
  name: string,
  text: string,
  x: number,
  color: Color,
  onClick: () => void,
): Button {
  const node = addRect(parent, name, actionY(), dialogButtonW(), BUTTON_H, color, x);
  const button = node.addComponent(Button);
  button.transition = Button.Transition.NONE;
  addLabel(node, `${name}Label`, text, 0, { size: 28, width: dialogButtonW() - 28 }).color = new Color(
    255,
    255,
    255,
    255,
  );
  node.on(Button.EventType.CLICK, onClick);
  return button;
}

/** 44×44 勾选框：描边空框，选中后实心 + 白色对勾。 */
export function paintCheckBox(node: Node, active: boolean): void {
  const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics);
  graphics.clear();
  graphics.lineWidth = 4;
  graphics.strokeColor = PALETTE.sub;
  graphics.rect(-22, -22, 44, 44);
  graphics.stroke();
  if (!active) {
    return;
  }
  graphics.fillColor = PALETTE.primary;
  graphics.rect(-22, -22, 44, 44);
  graphics.fill();
  graphics.strokeColor = new Color(255, 255, 255, 255);
  graphics.moveTo(-13, 1);
  graphics.lineTo(-4, -10);
  graphics.lineTo(14, 12);
  graphics.stroke();
}

/** 三份协议正文按估算行高堆进滚动区，长度不足时靠 ScrollView 回弹，不做硬裁剪。 */
export function buildDocScroll(parent: Node, y: number): void {
  const width = panelW() - 100;
  const textWidth = width - 40;
  const scrollNode = createNode(parent, 'PrivacyScroll', y, width, SCROLL_H);
  const scroll = scrollNode.addComponent(ScrollView);
  const viewNode = createNode(scrollNode, 'view', 0, width, SCROLL_H);
  viewNode.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
  const content = new Node('content');
  content.parent = viewNode;
  const transform = content.addComponent(UITransform);
  let offset = 0;
  LEGAL_DOCS.forEach((doc) => {
    const docNode = new Node(`Doc_${doc.id}`);
    docNode.parent = content;
    docNode.addComponent(UITransform).setContentSize(textWidth, LINE_H);
    docNode.setPosition(0, -offset - LINE_H / 2, 0);
    addLabel(docNode, 'Name', `《${doc.title}》`, 0, { size: 26, width: textWidth });
    offset += LINE_H + 6;
    doc.points.forEach((point) => {
      const height = Math.max(1, Math.ceil(point.length / CHARS_PER_LINE)) * LINE_H;
      const block = new Node('Point');
      block.parent = content;
      block.addComponent(UITransform).setContentSize(textWidth, height);
      block.setPosition(0, -offset - height / 2, 0);
      addLabel(block, 'Text', point, 0, { size: 22, color: PALETTE.sub, width: textWidth });
      offset += height + 10;
    });
    offset += 10;
  });
  transform.setContentSize(textWidth, Math.max(SCROLL_H, offset));
  transform.setAnchorPoint(0.5, 1);
  content.setPosition(0, SCROLL_H / 2, 0);
  scroll.content = content;
  scroll.vertical = true;
  scroll.horizontal = false;
}
