// STATUS: implemented, W18 化验视图（卡片/列布局 + 矩形命中 + 左右摇晃反馈）
import { Color, Graphics, Node, Tween, tween, UITransform, Vec3 } from 'cc';
import type { CaseConfigItem, CaseLabPair } from '../config/CaseConfig';
import { addLabel, addRect } from '../ui/SceneUI';
import { screenHeight, screenWidth } from '../ui/ScreenMetrics';

export const LAB_ITEM_W = 200;
export const LAB_ITEM_H = 64;
/** 720 帧下左右列各贴边 30：卡片 200 宽时占 -330..-130 与 130..330，留出中间拖拽通道。 */
export const LAB_COL_LEFT = -230;
export const LAB_COL_RIGHT = 230;
export const LAB_COL_TOP = 200;
const LAB_COL_SPAN = 400;
const LAB_COL_MAX_GAP = 96;
/** 手指落点允许比卡片外扩 18，避免边缘松手白拖。 */
const LAB_HIT_PAD = 18;

const CLEAR = new Color(0, 0, 0, 0);

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

/** 全屏透明画布：只负责画线，不挂触摸监听，不会抢卡片的手势。 */
export function buildDragLayer(parent: Node): Graphics | null {
  const node = addRect(parent, 'LabDragLayer', 0, screenWidth(), screenHeight(), CLEAR);
  node.setSiblingIndex(parent.children.length - 1);
  return node.getComponent(Graphics);
}

/** 矩形命中：含 18 的外扩边距，比原来的 36 半径圆覆盖整张 200×64 卡片。 */
export function isInsideCard(card: Node, world: Vec3): boolean {
  const local = toLocal(card, world);
  const size = card.getComponent(UITransform)?.contentSize;
  const halfW = (size?.width ?? LAB_ITEM_W) / 2 + LAB_HIT_PAD;
  const halfH = (size?.height ?? LAB_ITEM_H) / 2 + LAB_HIT_PAD;
  return Math.abs(local.x) <= halfW && Math.abs(local.y) <= halfH;
}

/** 配对失败反馈：卡片左右摇晃三次后回原位。 */
export function shakeCard(node: Node): void {
  const base = node.position;
  Tween.stopAllByTarget(node);
  node.setPosition(base.x, base.y, 0);
  tween(node)
    .to(0.05, { position: new Vec3(base.x + 14, base.y, 0) })
    .to(0.05, { position: new Vec3(base.x - 14, base.y, 0) })
    .to(0.05, { position: new Vec3(base.x + 10, base.y, 0) })
    .to(0.05, { position: new Vec3(base.x - 10, base.y, 0) })
    .to(0.06, { position: new Vec3(base.x, base.y, 0) })
    .start();
}

/** 世界坐标 → 节点局部坐标，全链路统一走 UITransform.convertToNodeSpaceAR。 */
export function toLocal(node: Node, world: Vec3): Vec3 {
  const transform = node.getComponent(UITransform);
  return transform ? transform.convertToNodeSpaceAR(world) : world;
}
