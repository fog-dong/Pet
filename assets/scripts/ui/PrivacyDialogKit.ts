// STATUS: implemented, W8-5 隐私弹窗控件（协议滚动正文 + 勾选框 + 统一按钮热区）
import { Button, Color, Graphics, Mask, Node, ScrollView, UITransform } from 'cc';
import { LEGAL_DOCS } from '../config/LegalConfig';
import { addLabel, addRect, createNode, PALETTE } from './SceneUI';

export const PANEL_W = 980;
export const PANEL_H = 580;
/** 按钮统一 320×76，高于 44×44 的最小可点热区。 */
export const BUTTON_Y = -220;

const SCROLL_W = 880;
const SCROLL_H = 270;
const TEXT_W = 840;
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
  const node = addRect(parent, name, BUTTON_Y, 320, 76, color, x);
  const button = node.addComponent(Button);
  button.transition = Button.Transition.NONE;
  addLabel(node, `${name}Label`, text, 0, { size: 28, width: 292 }).color = new Color(255, 255, 255, 255);
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
  const scrollNode = createNode(parent, 'PrivacyScroll', y, SCROLL_W, SCROLL_H);
  const scroll = scrollNode.addComponent(ScrollView);
  const viewNode = createNode(scrollNode, 'view', 0, SCROLL_W, SCROLL_H);
  viewNode.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
  const content = new Node('content');
  content.parent = viewNode;
  const transform = content.addComponent(UITransform);
  let offset = 0;
  LEGAL_DOCS.forEach((doc) => {
    const docNode = new Node(`Doc_${doc.id}`);
    docNode.parent = content;
    docNode.addComponent(UITransform).setContentSize(TEXT_W, LINE_H);
    docNode.setPosition(0, -offset - LINE_H / 2, 0);
    addLabel(docNode, 'Name', `《${doc.title}》`, 0, { size: 26, width: TEXT_W });
    offset += LINE_H + 6;
    doc.points.forEach((point) => {
      const height = Math.max(1, Math.ceil(point.length / CHARS_PER_LINE)) * LINE_H;
      const block = new Node('Point');
      block.parent = content;
      block.addComponent(UITransform).setContentSize(TEXT_W, height);
      block.setPosition(0, -offset - height / 2, 0);
      addLabel(block, 'Text', point, 0, { size: 22, color: PALETTE.sub, width: TEXT_W });
      offset += height + 10;
    });
    offset += 10;
  });
  transform.setContentSize(TEXT_W, Math.max(SCROLL_H, offset));
  transform.setAnchorPoint(0.5, 1);
  content.setPosition(0, SCROLL_H / 2, 0);
  scroll.content = content;
  scroll.vertical = true;
  scroll.horizontal = false;
}
