// STATUS: implemented, W4 拍片视图（卡通 X 光片 + 可拖拽标记框 + 命中/线索高亮）
import { Color, Graphics, Node } from 'cc';
import type { CaseConfigItem, CaseXrayLesion } from '../config/CaseConfig';
import { addLabel, addRect, PALETTE } from '../ui/SceneUI';
import { buildLightbox } from './XrayLightbox';

export const XRAY_BOARD_W = 560;
export const XRAY_BOARD_H = 460;
export const XRAY_MARKER_W = 132;
export const XRAY_MARKER_H = 96;
/** 初始 y：片子内高 392（半高 196），标记高 96，-132 让底边停在 -180，不压木框。 */
export const XRAY_START_Y = -132;

const CLEAR = new Color(0, 0, 0, 0);

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

/** 灯箱样式的片子：木框 + 深灰内衬 + 浅蓝胶片，病灶/标记共用 board 的局部坐标。 */
export function buildFilm(parent: Node): Node {
  return buildLightbox(parent, 'XrayBoard', XRAY_BOARD_W, XRAY_BOARD_H);
}

export function buildMarker(board: Node): Node {
  const marker = addRect(board, 'XrayMarker', XRAY_START_Y, XRAY_MARKER_W, XRAY_MARKER_H, CLEAR);
  const graphics = marker.getComponent(Graphics);
  if (graphics) {
    graphics.strokeColor = PALETTE.accent;
    graphics.lineWidth = 4;
    graphics.rect(-XRAY_MARKER_W / 2, -XRAY_MARKER_H / 2, XRAY_MARKER_W, XRAY_MARKER_H);
    graphics.moveTo(0, -12);
    graphics.lineTo(0, 12);
    graphics.moveTo(-12, 0);
    graphics.lineTo(12, 0);
    graphics.stroke();
  }
  addLabel(marker, 'XrayMarkerLabel', '标记', XRAY_MARKER_H / 2 + 18, { size: 20, color: PALETTE.accent });
  return marker;
}

export function paintHit(board: Node, lesion: CaseXrayLesion): void {
  const node = addRect(board, `Hit_${lesion.id}`, lesion.y, 96, 96, CLEAR, lesion.x);
  const graphics = node.getComponent(Graphics);
  if (graphics) {
    graphics.fillColor = new Color(127, 183, 126, 90);
    graphics.circle(0, 0, 44);
    graphics.fill();
    graphics.strokeColor = new Color(127, 183, 126, 255);
    graphics.lineWidth = 4;
    graphics.circle(0, 0, 44);
    graphics.stroke();
  }
  addLabel(node, 'HitLabel', lesion.label ?? '病灶', 62, { size: 20, color: PALETTE.accent });
}

export function paintClue(board: Node, lesion: CaseXrayLesion): Node {
  const node = addRect(board, 'XrayClue', lesion.y, 200, 200, CLEAR, lesion.x);
  const graphics = node.getComponent(Graphics);
  if (graphics) {
    graphics.strokeColor = new Color(226, 197, 143, 255);
    graphics.lineWidth = 6;
    graphics.circle(0, 0, 96);
    graphics.stroke();
  }
  return node;
}
