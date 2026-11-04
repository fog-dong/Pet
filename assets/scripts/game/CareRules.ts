// STATUS: implemented, W25 P2-D 护理纯规则（红点布局/命中判定/结果类型；只依赖类型，可被 Node strip-types 回归）
import type { HabitatPet } from '../cache/HabitatCodec';

export type CareOutcome =
  | { kind: 'done'; entry: HabitatPet; text: string }
  | { kind: 'failed'; entry: HabitatPet; text: string }
  | { kind: 'blocked'; text: string };

export interface NailDot {
  x: number;
  y: number;
}

/** 立绘局部坐标里的候选点位：四角 + 左右中点，按缺口数取前 N 个，保证最小间距 ≥ 100。 */
const NAIL_LAYOUT: readonly NailDot[] = [
  { x: -50, y: 50 }, { x: 50, y: 50 }, { x: -50, y: -50 }, { x: 50, y: -50 },
  { x: -50, y: 0 }, { x: 50, y: 0 },
];

/** 线性同余：每次开一局抖动 ±10，位置不完全相同，但同一 seed 重算结果一致（便于回归）。 */
function jitter(seed: number, index: number): number {
  const value = Math.imul(seed + index * 2654435761, 1597334677) >>> 0;
  return (value % 21) - 10;
}

export function nailDots(seed: number, count: number): NailDot[] {
  const total = Math.max(1, Math.min(NAIL_LAYOUT.length, Math.floor(count)));
  return NAIL_LAYOUT.slice(0, total).map((dot, index) => ({
    x: dot.x + jitter(seed, index),
    y: dot.y + jitter(seed, index + 7),
  }));
}

/** 就近命中：落在半径内取最近的一个；全部落空返回 -1，调用方据此判点错。 */
export function dotIndexAt(dots: readonly NailDot[], x: number, y: number, radius: number): number {
  let best = -1;
  let bestDistance = radius * radius;
  dots.forEach((dot, index) => {
    const dx = x - dot.x;
    const dy = y - dot.y;
    const distance = dx * dx + dy * dy;
    if (distance <= bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}
