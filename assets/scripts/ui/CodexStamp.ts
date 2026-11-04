// STATUS: implemented, W25-P1 图鉴已领养红戳（90×38 压在卡片右上角，双线圆角框 + 旋转 -12°）
import { Color, Graphics, Node } from 'cc';
import { makeLabel } from './FontKit';

const SEAL_RED = new Color(197, 72, 60, 255);

/** 双列窄卡的红戳：缩到 90×38 后只占右上角，不碰 112 立绘和三行文字。 */
export function addAdoptedStamp(card: Node, x: number, y: number): Node {
  const stamp = new Node('AdoptedStamp');
  stamp.parent = card;
  stamp.setPosition(x, y, 0);
  stamp.angle = -12;
  const graphics = stamp.addComponent(Graphics);
  graphics.strokeColor = SEAL_RED;
  graphics.lineWidth = 3;
  graphics.roundRect(-45, -19, 90, 38, 7);
  graphics.stroke();
  graphics.lineWidth = 1.5;
  graphics.roundRect(-39, -13, 78, 26, 5);
  graphics.stroke();
  const label = makeLabel(stamp, 'StampText', '已领养', 0, {
    size: 20,
    color: SEAL_RED,
    width: 80,
  });
  label.isBold = true;
  return stamp;
}
