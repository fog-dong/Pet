// STATUS: implemented, W4 化验视图（样本/试剂卡片 + 拖拽连线与命中判定）
import { Color, Graphics, Node, UITransform, Vec3 } from 'cc';
import type { CaseConfigItem, CaseLabPair } from '../config/CaseConfig';
import { addLabel, addRect } from '../ui/SceneUI';

export const LAB_ITEM_W = 200;
export const LAB_ITEM_H = 64;
export const LAB_COL_LEFT = -330;
export const LAB_COL_RIGHT = 330;
export const LAB_HIT_RADIUS = 36;
export const LAB_COL_TOP = 200;
const LAB_COL_SPAN = 400;
const LAB_COL_MAX_GAP = 96;

const CLEAR = new Color(0, 0, 0, 0);
const LINE = new Color(226, 197, 143, 220);

export interface LabCard {
  name: string;
  node: Node;
  matched: boolean;
}

const RULES: Record<number, { pairs: number; decoys: number }> = {
  1: { pairs: 3, decoys: 0 },
  2: { pairs: 3, decoys: 1 },
  3: { pairs: 4, decoys: 2 },
  4: { pairs: 4, decoys: 2 },
  5: { pairs: 4, decoys: 2 },
};

const FALLBACK_PAIRS: CaseLabPair[] = [
  { sample: '血液样本', reagent: '血常规' },
  { sample: '尿液样本', reagent: '尿检' },
  { sample: '皮肤刮片', reagent: '镜检' },
];
const FALLBACK_DECOYS = ['便检', '耳道分泌物'];

export interface LabPlan {
  pairs: CaseLabPair[];
  reagents: string[];
}

/** 按难度取配对数与干扰项；试剂列倒序，避免与样本列一一对齐被一眼看穿。 */
export function resolveLab(item: CaseConfigItem): LabPlan {
  const difficulty = Math.max(1, Math.min(5, Math.round(item.diagnosisDifficulty || 1)));
  const rule = RULES[difficulty] ?? RULES[1];
  const source = item.lab?.pairs?.length ? item.lab.pairs : FALLBACK_PAIRS;
  const pairs = source.slice(0, rule.pairs);
  const decoys = (item.lab?.decoys ?? FALLBACK_DECOYS).slice(0, rule.decoys);
  const reagents = pairs.map((pair) => pair.reagent).concat(decoys).reverse();
  return { pairs, reagents };
}

export function buildColumn(
  parent: Node,
  names: string[],
  x: number,
  color: Color,
  prefix: string,
): LabCard[] {
  const gap = Math.min(LAB_COL_MAX_GAP, LAB_COL_SPAN / Math.max(1, names.length - 1));
  return names.map((name, index) => ({
    name,
    node: buildCard(parent, name, LAB_COL_TOP - index * gap, x, color, prefix),
    matched: false,
  }));
}

export function buildCard(
  parent: Node,
  name: string,
  y: number,
  x: number,
  color: Color,
  prefix: string,
): Node {
  const node = addRect(parent, `${prefix}_${name}`, y, LAB_ITEM_W, LAB_ITEM_H, color, x);
  addLabel(node, `${node.name}Label`, name, 0, { size: 24, width: LAB_ITEM_W - 16 });
  return node;
}

export function buildDragLayer(parent: Node): Graphics | null {
  const node = addRect(parent, 'LabDragLayer', 0, 1280, 720, CLEAR);
  node.setSiblingIndex(parent.children.length - 1);
  return node.getComponent(Graphics);
}

export function clearDrag(layer: Graphics | null): void {
  layer?.clear();
}

export function drawDrag(layer: Graphics, fromWorld: Vec3, toWorld: Vec3): void {
  const node = layer.node;
  const from = toLocal(node, fromWorld);
  const to = toLocal(node, toWorld);
  layer.clear();
  layer.strokeColor = LINE;
  layer.lineWidth = 4;
  layer.moveTo(from.x, from.y);
  layer.lineTo(to.x, to.y);
  layer.stroke();
}

/** 正确配对后保留一条静态连线（每对一张独立 Graphics，互不覆盖）。 */
export function drawPair(parent: Node, fromWorld: Vec3, toWorld: Vec3): void {
  const node = addRect(parent, 'LabPairLine', 0, 1280, 720, CLEAR);
  node.setSiblingIndex(parent.children.length - 2);
  const graphics = node.getComponent(Graphics);
  if (!graphics) {
    return;
  }
  const from = toLocal(node, fromWorld);
  const to = toLocal(node, toWorld);
  graphics.strokeColor = new Color(127, 183, 126, 235);
  graphics.lineWidth = 6;
  graphics.moveTo(from.x, from.y);
  graphics.lineTo(to.x, to.y);
  graphics.stroke();
}

/** UI 坐标 → 卡片局部坐标，判断手指是否落在卡片圆形热区内。 */
export function containsPoint(card: Node, ui: { x: number; y: number }): boolean {
  const local = toLocal(card, new Vec3(ui.x, ui.y, 0));
  return Math.hypot(local.x, local.y) <= LAB_HIT_RADIUS;
}

function toLocal(node: Node, world: Vec3): Vec3 {
  const transform = node.getComponent(UITransform);
  return transform ? transform.convertToNodeSpaceAR(world) : world;
}
