// STATUS: implemented, W27 P3-UI 模块三 TAB 红点：1 件画圆点、多件画数字胶囊，纯 Graphics 自绘，不引贴图
// 必须挂成按钮节点的子节点：setUIButtonState 每帧都会 paint() 重画按钮自己的 Graphics，同级兄弟会被擦掉。
import { Graphics, Node, UITransform, Vec3, tween } from 'cc';
import { makeLabel } from './FontKit';
import { COLORS, DURATION, HEX, tint } from './Tokens';

const DOT_R = 11;
const PILL_H = 26;
const PILL_MIN_W = 26;
const CHAR_W = 13;
const CHAR_PAD = 14;
/** 超过这个数就收成 99+：三位以上没人读得完，胶囊还会糊到邻键上。 */
const COUNT_MAX = 99;
/** 压住键角：圆心比右沿少 8、比上沿少 5，正好探出木底一条边，读成「贴在上面的一枚」。 */
const INSET_X = 8;
const INSET_Y = 5;
/** 白描边把红点从 clay 选中态里剥出来，否则同色系会糊成一块。 */
const RING = COLORS.paper;
const FILL = tint(HEX.alert);

export interface RedDotHandle {
  set(count: number): void;
}

export function attachRedDot(parent: Node, name: string): RedDotHandle {
  const node = new Node(name);
  node.parent = parent;
  node.addComponent(UITransform).setContentSize(PILL_H, PILL_H);
  const graphics = node.addComponent(Graphics);
  const label = makeLabel(node, `${name}Num`, '', 0, { size: 17, width: PILL_MIN_W, color: COLORS.white });
  place(node, parent);
  let shown = 0;
  return {
    set(count: number): void {
      const next = Math.max(0, Math.floor(count));
      node.active = next > 0;
      // 每次切 TAB、每 30 秒定时刷都会重算一遍：数字没变就一口不动，否则红点整天在弹。
      if (next === shown) {
        return;
      }
      shown = next;
      if (next === 0) {
        return;
      }
      paint(graphics, next);
      label.string = next === 1 ? '' : text(next);
      node.setScale(0.5, 0.5, 1);
      tween(node).to(DURATION.card, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
    },
  };
}

function place(node: Node, parent: Node): void {
  const size = parent.getComponent(UITransform);
  const width = size?.contentSize.width ?? PILL_H * 2;
  const height = size?.contentSize.height ?? PILL_H;
  node.setPosition(width / 2 - INSET_X, height / 2 - INSET_Y, 0);
}

function text(count: number): string {
  return count > COUNT_MAX ? `${COUNT_MAX}+` : String(count);
}

function paint(graphics: Graphics, count: number): void {
  graphics.clear();
  graphics.fillColor = FILL;
  graphics.strokeColor = RING;
  graphics.lineWidth = 2;
  if (count === 1) {
    graphics.circle(0, 0, DOT_R);
    graphics.fill();
    graphics.stroke();
    return;
  }
  const width = Math.max(PILL_MIN_W, text(count).length * CHAR_W + CHAR_PAD);
  graphics.roundRect(-width / 2, -PILL_H / 2, width, PILL_H, PILL_H / 2);
  graphics.fill();
  graphics.stroke();
}
