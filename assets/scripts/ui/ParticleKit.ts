// STATUS: implemented, W25 P0-A 程序化粒子与抛物线（Graphics 自绘，零美术资源；规格见 docs/plan/可玩性升级实施方案.md §4.3）
// 分包体积预算 0KB：爱心 / 泡泡 / 骨头全部矢量绘制，不引入贴图与 Spine。Quality.low 只减量与缩短时长。
import { Color, Graphics, Node, UIOpacity, Vec3, tween } from 'cc';
import { Quality } from '../config/Quality';
import { COLORS, DURATION } from './Tokens';

export interface Point {
  x: number;
  y: number;
}

/** 爱心粒子：从触点上方出生，边升边散、尾段淡出。抚摸用。 */
export function spawnHearts(parent: Node, at: Point, count = 6): void {
  const total = Quality.low ? 3 : count;
  for (let i = 0; i < total; i += 1) {
    const drift = (Math.random() - 0.5) * 80;
    spawn(parent, `Heart${i}`, at.x + drift, at.y + 20, heartPath, COLORS.clay, 22, 120 + i * 8, drift * 0.3, 0.06 * i);
  }
}

/** 泡泡：从立绘下缘上飘，大小不一。洗澡用。 */
export function spawnBubbles(parent: Node, at: Point, count = 8): void {
  const total = Quality.low ? 3 : count;
  for (let i = 0; i < total; i += 1) {
    const drift = (Math.random() - 0.5) * 60;
    const radius = 8 + Math.random() * 10;
    spawn(parent, `Bubble${i}`, at.x + drift, at.y - 40 - Math.random() * 20, bubblePath, COLORS.mist, radius, 140, drift - 8, 0.06 * i);
  }
}

export type TossKind = 'bone' | 'pellet';

/**
 * 道具抛物线：两段 to() 近似重力弧线（上升 quadOut + 下落 quadIn），到位后回调接咀嚼。
 * from / to 均为 parent 局部坐标；弧高取水平距离的 0.35 倍，短距离也不会画成直上直下。
 */
export function tossTo(
  parent: Node,
  from: Point,
  to: Point,
  kind: TossKind,
  onArrive: () => void,
): void {
  const node = new Node(`Toss_${kind}`);
  node.parent = parent;
  node.setPosition(from.x, from.y, 0);
  drawItem(node.addComponent(Graphics), kind);
  const apex = (from.y + to.y) / 2 + Math.abs(to.x - from.x) * 0.35 + 40;
  const half = Quality.low ? DURATION.toss / 4 : DURATION.toss / 2;
  tween(node)
    .to(half, { position: new Vec3((from.x + to.x) / 2, apex, 0) }, { easing: 'quadOut' })
    .to(half, { position: new Vec3(to.x, to.y, 0) }, { easing: 'quadIn' })
    .call(() => {
      node.destroy();
      onArrive();
    })
    .start();
}

/** 出生即自毁的单颗粒子：位移与淡出两条 tween 并行，互不阻塞。 */
function spawn(
  parent: Node,
  name: string,
  x: number,
  y: number,
  paint: (g: Graphics, r: number, color: Color) => void,
  color: Color,
  radius: number,
  rise: number,
  sway: number,
  delay: number,
): void {
  const node = new Node(name);
  node.parent = parent;
  node.setPosition(x, y, 0);
  const g = node.addComponent(Graphics);
  g.fillColor = color;
  g.strokeColor = color;
  paint(g, radius, color);
  const opacity = node.addComponent(UIOpacity);
  opacity.opacity = 0;
  const life = Quality.low ? DURATION.particle / 2 : DURATION.particle;
  const wait = Quality.low ? 0 : delay;
  tween(node)
    .delay(wait)
    .to(life, { position: new Vec3(x + sway, y + rise, 0) }, { easing: 'quadOut' })
    .start();
  tween(opacity)
    .delay(wait)
    .to(life * 0.4, { opacity: 255 }, { easing: 'quadOut' })
    .to(life * 0.6, { opacity: 0 }, { easing: 'sineIn' })
    .call(() => {
      if (node.isValid) {
        node.destroy();
      }
    })
    .start();
}

/** 心形 = 倒三角 + 两枚圆叶，同色一次填充即为并集，比贝塞尔曲线更稳。 */
function heartPath(g: Graphics, r: number): void {
  g.moveTo(0, -r);
  g.lineTo(-0.72 * r, 0.2 * r);
  g.lineTo(0.72 * r, 0.2 * r);
  g.close();
  g.circle(-0.36 * r, 0.36 * r, 0.38 * r);
  g.circle(0.36 * r, 0.36 * r, 0.38 * r);
  g.fill();
}

/** 泡泡 = 外圈描边 + 右上高光小圈，描边才读得出"透明"。 */
function bubblePath(g: Graphics, r: number): void {
  g.lineWidth = Math.max(2, r * 0.26);
  g.circle(0, 0, r);
  g.circle(r * 0.34, r * 0.34, r * 0.18);
  g.stroke();
}

/** 骨头 = 两端各两枚圆 + 中间方杆；高级粮 = 深木色圆片带高光。0.45s 飞行里形状要一眼认得出。 */
function drawItem(g: Graphics, kind: TossKind): void {
  if (kind === 'pellet') {
    g.fillColor = COLORS.sub;
    g.circle(0, 0, 13);
    g.fill();
    g.fillColor = COLORS.paper;
    g.circle(-4, 4, 3.5);
    g.fill();
    return;
  }
  g.fillColor = COLORS.paper;
  g.roundRect(-14, -5, 28, 10, 5);
  [-14, 14].forEach((cx) => {
    g.circle(cx, 7, 7);
    g.circle(cx, -7, 7);
  });
  g.fill();
  g.strokeColor = COLORS.skirt;
  g.lineWidth = 2;
  g.roundRect(-14, -5, 28, 10, 5);
  g.stroke();
}
