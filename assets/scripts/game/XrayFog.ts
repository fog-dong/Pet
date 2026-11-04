// STATUS: implemented, W25 P1-B 拍片马赛克雾气（单 Graphics 网格重绘；擦除按距离衰减，逐帧合并刷新）
import { Color, Graphics, Node } from 'cc';
import { createNode } from '../ui/SceneUI';

export const FOG_W = 504;
export const FOG_H = 392;
const COLS = 14;
const ROWS = 11;
const CELL_W = FOG_W / COLS;
const CELL_H = FOG_H / ROWS;
const LEFT = -FOG_W / 2;
const TOP = FOG_H / 2;
const TINTS: readonly Color[] = [
  new Color(104, 118, 136),
  new Color(124, 138, 156),
  new Color(112, 128, 146),
];

export class XrayFog {
  private readonly graphics: Graphics;
  private readonly amount: number[] = [];
  private dirty = false;

  constructor(parent: Node) {
    const node = createNode(parent, 'XrayFog', 0, FOG_W, FOG_H);
    this.graphics = node.addComponent(Graphics);
    for (let i = 0; i < COLS * ROWS; i += 1) {
      this.amount.push(1);
    }
    this.draw();
  }

  /** 擦一次：半径内的雾块按距离衰减，边缘留一点残雾，来回擦才透亮。 */
  wipe(x: number, y: number, radius: number): void {
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const index = row * COLS + col;
        if (this.amount[index] <= 0) {
          continue;
        }
        const dist = Math.hypot(LEFT + (col + 0.5) * CELL_W - x, TOP - (row + 0.5) * CELL_H - y);
        if (dist >= radius) {
          continue;
        }
        this.amount[index] = Math.max(0, this.amount[index] - (0.55 + 0.45 * (1 - dist / radius)));
        this.dirty = true;
      }
    }
  }

  /** 目标点周围已擦掉的比例（0-1），病灶显影判定用。 */
  coverage(cx: number, cy: number, radius: number): number {
    let total = 0;
    let remain = 0;
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        if (Math.hypot(LEFT + (col + 0.5) * CELL_W - cx, TOP - (row + 0.5) * CELL_H - cy) > radius) {
          continue;
        }
        total += 1;
        remain += this.amount[row * COLS + col];
      }
    }
    return total === 0 ? 0 : 1 - remain / total;
  }

  /** 整片残余雾量 0-1；给回归脚本做「确实擦掉了」的证据。 */
  remaining(): number {
    return this.amount.reduce((sum, value) => sum + value, 0) / this.amount.length;
  }

  /** 每帧最多重绘一次：滑动时 wipe 连续触发，攒到帧末画一次，避免逐点重建网格。 */
  flush(): void {
    if (!this.dirty) {
      return;
    }
    this.dirty = false;
    this.draw();
  }

  private draw(): void {
    const graphics = this.graphics;
    graphics.clear();
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const amount = this.amount[row * COLS + col];
        if (amount <= 0.04) {
          continue;
        }
        const tint = TINTS[(row * 5 + col * 3) % TINTS.length];
        // 不透明度封顶 206：底下的红晕能透出一点，玩家才有线索可循。
        graphics.fillColor = new Color(tint.r, tint.g, tint.b, Math.round(206 * amount));
        graphics.roundRect(LEFT + col * CELL_W + 1, TOP - (row + 1) * CELL_H + 1, CELL_W - 2, CELL_H - 2, 4);
        graphics.fill();
      }
    }
  }
}
