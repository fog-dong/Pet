// STATUS: implemented, W25 拍片视图（深色片子 + 红色发光病灶 + 命中显影反馈；雾层见 XrayFog）
import { Color, Graphics, Node, tween, Vec3 } from 'cc';
import type { CaseConfigItem, CaseXrayLesion } from '../config/CaseConfig';
import { addLabel, addRect } from '../ui/SceneUI';
import { buildLightbox } from './XrayLightbox';

export const XRAY_BOARD_W = 560;
export const XRAY_BOARD_H = 460;

const CLEAR = new Color(0, 0, 0, 0);
const LESION_RED = new Color(255, 74, 62, 255);

export interface XrayLesion extends CaseXrayLesion {
  done: boolean;
}

export interface XrayPlan {
  lesions: XrayLesion[];
  tolerance: number;
}

const RULES: Record<number, { lesions: number; tolerance: number }> = {
  1: { lesions: 1, tolerance: 110 },
  2: { lesions: 1, tolerance: 90 },
  3: { lesions: 2, tolerance: 75 },
  4: { lesions: 2, tolerance: 70 },
  5: { lesions: 2, tolerance: 65 },
};

const FALLBACK: Record<number, CaseXrayLesion[]> = {
  1: [{ id: 'lesion_0', x: 40, y: -30 }],
  2: [{ id: 'lesion_0', x: 70, y: 20 }],
  3: [
    { id: 'lesion_0', x: 60, y: 70 },
    { id: 'lesion_1', x: -70, y: -60 },
  ],
};

/** 按难度取病灶数量与容差；病例没配点位时用兜底点位。 */
export function resolveLesions(item: CaseConfigItem): XrayPlan {
  const difficulty = Math.max(1, Math.min(5, Math.round(item.diagnosisDifficulty || 1)));
  const rule = RULES[difficulty] ?? RULES[1];
  const pool = item.xray?.lesions?.length ? item.xray.lesions : FALLBACK[difficulty] ?? FALLBACK[1];
  return {
    lesions: pool.slice(0, rule.lesions).map((lesion) => ({ ...lesion, done: false })),
    tolerance: rule.tolerance,
  };
}

/** 灯箱样式的片子：木框 + 深色背板 + 黑色胶片 + 白色骨廓。 */
export function buildFilm(parent: Node): Node {
  return buildLightbox(parent, 'XrayBoard', XRAY_BOARD_W, XRAY_BOARD_H);
}

/** 红色病灶常驻显示并轻微呼吸，玩家用放大镜盖住它才算定位。 */
export function paintLesions(board: Node, lesions: readonly XrayLesion[]): void {
  for (const lesion of lesions) {
    const node = addRect(board, `Lesion_${lesion.id}`, lesion.y, 190, 190, CLEAR, lesion.x);
    const graphics = node.getComponent(Graphics);
    if (!graphics) {
      continue;
    }
    // 由外到内叠四层红晕，最里层接近白热，深色底上才像“发光”。
    const layers: readonly [number, number][] = [[72, 20], [52, 44], [34, 92], [20, 170]];
    for (const [radius, alpha] of layers) {
      graphics.fillColor = new Color(LESION_RED.r, LESION_RED.g, LESION_RED.b, alpha);
      graphics.circle(0, 0, radius);
      graphics.fill();
    }
    graphics.fillColor = new Color(255, 214, 208, 225);
    graphics.circle(0, 0, 9);
    graphics.fill();
    tween(node)
      .repeatForever(
        tween(node)
          .to(0.75, { scale: new Vec3(1.1, 1.1, 1) })
          .to(0.75, { scale: Vec3.ONE }),
      )
      .start();
  }
}

export function paintHit(board: Node, lesion: CaseXrayLesion): void {
  const node = addRect(board, `Hit_${lesion.id}`, lesion.y, 150, 150, CLEAR, lesion.x);
  const graphics = node.getComponent(Graphics);
  if (graphics) {
    graphics.strokeColor = new Color(127, 214, 140, 255);
    graphics.lineWidth = 6;
    graphics.circle(0, 0, 58);
    graphics.stroke();
    graphics.fillColor = new Color(127, 214, 140, 46);
    graphics.circle(0, 0, 58);
    graphics.fill();
  }
  addLabel(node, 'HitLabel', lesion.label ?? '病灶', 78, { size: 22, color: new Color(170, 232, 176, 255) });
  // 显影落章：一次过冲回弹，比静态圆圈更能让玩家确认「擦对了」。
  node.setScale(1.4, 1.4, 1);
  tween(node).to(0.32, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
}
