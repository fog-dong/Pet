// STATUS: implemented, W18 图鉴已领养红戳（Graphics 双线圆角框 + 旋转 -14°）
import { Color, Graphics, Node } from 'cc';
import { makeLabel } from './FontKit';

const SEAL_RED = new Color(197, 72, 60, 255);

/** 已领养印章：斜盖在卡片右侧，红框红字，和状态文案区分开。 */
export function addAdoptedStamp(card: Node, x: number, y: number): Node {
  const stamp = new Node('AdoptedStamp');
  stamp.parent = card;
  stamp.setPosition(x, y, 0);
  stamp.angle = -14;
  const graphics = stamp.addComponent(Graphics);
  graphics.strokeColor = SEAL_RED;
  graphics.lineWidth = 5;
  graphics.roundRect(-70, -30, 140, 60, 12);
  graphics.stroke();
  graphics.lineWidth = 2;
  graphics.roundRect(-61, -22, 122, 44, 8);
  graphics.stroke();
  const label = makeLabel(stamp, 'StampText', '已领养', 0, {
    size: 27,
    color: SEAL_RED,
    width: 120,
  });
  label.isBold = true;
  return stamp;
}
