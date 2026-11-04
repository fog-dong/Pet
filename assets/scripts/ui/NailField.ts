// STATUS: implemented, W25 P2-D 剪指甲场地绘制（米色场地 / 红点 / 点错抖动，Graphics 不新增贴图）
import { Graphics, Node, Tween, UITransform, Vec3, tween } from 'cc';
import { NailDot } from '../game/CareRules';
import { COLORS, HEX, tint } from './Tokens';

export const FIELD = 380;
const DOT_R = 26;

export function makeNailField(panel: Node, y: number): Node {
  const node = new Node('NailField');
  node.parent = panel;
  node.setPosition(0, y, 0);
  node.addComponent(UITransform).setContentSize(FIELD, FIELD);
  const graphics = node.addComponent(Graphics);
  graphics.fillColor = tint(HEX.cream);
  graphics.roundRect(-FIELD / 2, -FIELD / 2, FIELD, FIELD, 24);
  graphics.fill();
  graphics.strokeColor = tint(HEX.skirt);
  graphics.lineWidth = 3;
  graphics.roundRect(-FIELD / 2, -FIELD / 2, FIELD, FIELD, 24);
  graphics.stroke();
  return node;
}

/** 已剪掉的点不再重绘；红点挂白环是为了在米色底和宠物毛色上都能看清。 */
export function makeNailDots(field: Node, dots: readonly NailDot[], hit: boolean[]): { redraw(): void } {
  const node = new Node('NailDots');
  node.parent = field;
  node.addComponent(UITransform).setContentSize(FIELD, FIELD);
  const graphics = node.addComponent(Graphics);
  // 红点合批画在同一个 Graphics 上，另留同坐标空节点给验收脚本定位。
  const marks = dots.map((dot, index) => {
    const mark = new Node(`NailDot_${index}`);
    mark.parent = node;
    mark.setPosition(dot.x, dot.y, 0);
    mark.addComponent(UITransform).setContentSize(DOT_R * 2, DOT_R * 2);
    return mark;
  });
  return {
    redraw(): void {
      graphics.clear();
      dots.forEach((dot, index) => {
        if (hit[index]) {
          return;
        }
        graphics.fillColor = COLORS.danger;
        graphics.circle(dot.x, dot.y, DOT_R);
        graphics.fill();
        graphics.strokeColor = COLORS.white;
        graphics.lineWidth = 4;
        graphics.circle(dot.x, dot.y, DOT_R);
        graphics.stroke();
      });
      marks.forEach((mark, index) => {
        mark.active = !hit[index];
      });
    },
  };
}

/** 点错：宠物左右抖 0.32s，和"剪刀歪了"的文案同一节拍；面板与红点保持不动，视线留在出错对象上。 */
export function shakePet(node: Node): void {
  if (!node.isValid) {
    return;
  }
  const x = node.position.x;
  const y = node.position.y;
  Tween.stopAllByTarget(node);
  tween(node)
    .to(0.06, { position: new Vec3(x - 16, y, 0) })
    .to(0.08, { position: new Vec3(x + 13, y, 0) })
    .to(0.08, { position: new Vec3(x - 9, y, 0) })
    .to(0.1, { position: new Vec3(x, y, 0) })
    .start();
}
