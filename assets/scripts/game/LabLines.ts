// STATUS: implemented, W18 化验连线绘制（拖拽绿线 + 配对固定线，全部转局部坐标）
import { Color, Graphics, Node, Vec3 } from 'cc';
import { addRect } from '../ui/SceneUI';
import { screenHeight, screenWidth } from '../ui/ScreenMetrics';
import { toLocal } from './LabView';

const CLEAR = new Color(0, 0, 0, 0);
const DRAG = new Color(112, 208, 132, 240);
const PAIR = new Color(96, 205, 122, 255);
const PAIR_GLOW = new Color(96, 205, 122, 70);

export function clearDrag(layer: Graphics | null): void {
  layer?.clear();
}

/** 手指拖拽中的绿线：起点是卡片中心，终点是手指，两端各点一个小圆点让接点更清楚。 */
export function drawDrag(layer: Graphics, fromWorld: Vec3, toWorld: Vec3): void {
  const node = layer.node;
  const from = toLocal(node, fromWorld);
  const to = toLocal(node, toWorld);
  layer.clear();
  layer.strokeColor = DRAG;
  layer.lineWidth = 6;
  layer.moveTo(from.x, from.y);
  layer.lineTo(to.x, to.y);
  layer.stroke();
  layer.fillColor = DRAG;
  layer.circle(from.x, from.y, 6);
  layer.fill();
  layer.circle(to.x, to.y, 8);
  layer.fill();
}

/** 正确配对后保留一条发光绿线（每对一张独立 Graphics，互不覆盖）。 */
export function drawPair(parent: Node, fromWorld: Vec3, toWorld: Vec3): void {
  const node = addRect(parent, 'LabPairLine', 0, screenWidth(), screenHeight(), CLEAR);
  node.setSiblingIndex(parent.children.length - 2);
  const graphics = node.getComponent(Graphics);
  if (!graphics) {
    return;
  }
  const from = toLocal(node, fromWorld);
  const to = toLocal(node, toWorld);
  graphics.strokeColor = PAIR_GLOW;
  graphics.lineWidth = 18;
  graphics.moveTo(from.x, from.y);
  graphics.lineTo(to.x, to.y);
  graphics.stroke();
  graphics.strokeColor = PAIR;
  graphics.lineWidth = 5;
  graphics.moveTo(from.x, from.y);
  graphics.lineTo(to.x, to.y);
  graphics.stroke();
  graphics.fillColor = PAIR;
  graphics.circle(from.x, from.y, 6);
  graphics.fill();
  graphics.circle(to.x, to.y, 6);
  graphics.fill();
}
