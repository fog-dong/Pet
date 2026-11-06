// STATUS: implemented, W25 P1-A 寻访场景美术（街景 + 纸箱全部 Graphics 自绘，零新增贴图）
import { Button, Graphics, Node, UIOpacity, UITransform } from 'cc';
import { screenHeight, screenWidth } from './ScreenMetrics';
import { makeLabel } from './FontKit';
import { bindPressEffect } from './UIButton';
import { COLORS, tint } from './Tokens';

export interface GachaBoxHandle {
  root: Node;
  body: Node;
  lid: Node;
  lidOpacity: UIOpacity;
  /** 整个箱体的透明度：结果卡落位后淡出，换下一抽时复位。 */
  rootOpacity: UIOpacity;
  /** 盖子初始高度：开箱后复位用，避免 UI 侧再抄一份数字。 */
  lidHomeY: number;
}
const WINDOWS: ReadonlyArray<readonly [number, number]> = [
  [-300, 300],
  [-228, 300],
  [-300, 218],
  [-228, 218],
  [228, 292],
  [300, 292],
  [228, 206],
];

/** 暖色街景：远墙、窗户、路面、路灯和箱边的草，一屏画完，切场景即销毁。 */export function paintStreet(parent: Node): void {
  const width = screenWidth();
  const height = screenHeight();
  const node = new Node('GachaStreet');
  node.parent = parent;
  node.addComponent(UITransform).setContentSize(width, height);
  const g = node.addComponent(Graphics);
  g.fillColor = tint('#F8E6CE');
  g.rect(-width / 2, -height / 2, width, height);
  g.fill();
  g.fillColor = tint('#EFD5B3');
  g.rect(-width / 2, -40, width, height * 0.38);
  g.fill();
  g.fillColor = tint('#F4C07A', 90);
  g.circle(width * 0.28, height * 0.24, 150);
  g.fill();
  g.fillColor = tint('#DCC4A7');
  g.rect(-width / 2, -20, 236, 420);
  g.fill();
  g.fillColor = tint('#CEB395');
  g.rect(-width / 2 + 150, -20, 180, 300);
  g.fill();
  g.fillColor = tint('#E4CEB4');
  g.rect(width / 2 - 250, -10, 250, 370);
  g.fill();
  g.fillColor = tint('#F7E0B8', 200);
  for (const [x, y] of WINDOWS) {
    g.rect(x - 16, y - 22, 32, 44);
    g.fill();
  }
  g.fillColor = tint('#E6CFB0');
  g.rect(-width / 2, -height / 2, width, height * 0.44);
  g.fill();
  g.fillColor = tint('#D2B897');
  g.rect(-width / 2, -height / 2 + height * 0.44, width, 18);
  g.fill();
  g.fillColor = tint('#8F7A65');
  g.rect(-width / 2 + 86, -50, 14, 330);
  g.fill();
  g.fillColor = tint('#F6C77E', 110);
  g.circle(-width / 2 + 93, 292, 54);
  g.fill();
  g.fillColor = tint('#F6C77E');
  g.circle(-width / 2 + 93, 292, 28);
  g.fill();
  drawTuft(g, -190, -300);
  drawTuft(g, 184, -318);
  drawTuft(g, 238, -270);
}
/** 纸箱带盖：盖子里单独挂节点，开箱时盖子飞出去，箱体只做挤压回弹。 */
export function buildGachaBox(parent: Node, onTap: () => void): GachaBoxHandle {
  const root = new Node('GachaBox');
  root.parent = parent;
  root.setPosition(0, -195, 0);
  root.addComponent(UITransform).setContentSize(300, 300);
  const button = root.addComponent(Button);
  button.transition = Button.Transition.NONE;
  root.on(Button.EventType.CLICK, onTap);
  // 抖动是 root 的 angle、按压是 root 的 scale，两者都归 Tween.stopAllByTarget 管：开箱动画起手会一并收干净。
  bindPressEffect(root);
  const body = new Node('BoxBody');
  body.parent = root;
  body.setPosition(0, -24, 0);
  body.addComponent(UITransform).setContentSize(220, 150);
  const bg = body.addComponent(Graphics);
  bg.fillColor = tint('#C58E5E');
  bg.roundRect(-110, -75, 220, 150, 10);
  bg.fill();
  bg.fillColor = tint('#B37C4C');
  bg.rect(-110, -75, 26, 150);
  bg.fill();
  bg.fillColor = tint('#EADFC8');
  bg.rect(-15, -75, 30, 150);
  bg.fill();
  bg.strokeColor = tint('#9A6A3F');
  bg.lineWidth = 3;
  bg.roundRect(-110, -75, 220, 150, 10);
  bg.stroke();
  const mark = makeLabel(body, 'BoxMark', '?', 2, { size: 62, color: COLORS.ink, width: 120 });
  mark.isBold = true;
  const lid = new Node('BoxLid');
  lid.parent = root;
  const lidHomeY = 62;
  lid.setPosition(0, lidHomeY, 0);
  lid.addComponent(UITransform).setContentSize(244, 42);
  const lg = lid.addComponent(Graphics);
  lg.fillColor = tint('#B07848');
  lg.roundRect(-122, -21, 244, 42, 8);
  lg.fill();
  lg.fillColor = tint('#F0E3CB');
  lg.rect(-16, -21, 32, 42);
  lg.fill();
  lg.strokeColor = tint('#8F5F38');
  lg.lineWidth = 3;
  lg.roundRect(-122, -21, 244, 42, 8);
  lg.stroke();
  return { root, body, lid, lidOpacity: lid.addComponent(UIOpacity), rootOpacity: root.addComponent(UIOpacity), lidHomeY };
}

/** 稀有度光环：外圈淡、内圈稍亮，放在立绘下面。 */
export function makeGlow(parent: Node, hex: string, y: number): Node {
  const node = new Node('GachaGlow');
  node.parent = parent;
  node.setPosition(0, y, 0);
  node.addComponent(UITransform).setContentSize(360, 360);
  const g = node.addComponent(Graphics);
  g.fillColor = tint(hex, 50);
  g.circle(0, 0, 176);
  g.fill();
  g.fillColor = tint(hex, 90);
  g.circle(0, 0, 140);
  g.fill();
  return node;
}
function drawTuft(g: Graphics, x: number, y: number): void {
  g.fillColor = tint('#8FAE86');
  g.moveTo(x - 18, y);
  g.lineTo(x - 8, y + 34);
  g.lineTo(x + 2, y);
  g.close();
  g.moveTo(x - 2, y);
  g.lineTo(x + 10, y + 42);
  g.lineTo(x + 18, y);
  g.close();
  g.fill();
}
