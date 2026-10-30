// STATUS: implemented, W11-3 竖屏设计帧 720×1280（policy=4 FIXED_WIDTH：宽度恒等于设计宽，高度随屏幕比例变大）
// 引擎口径：view.getVisibleSize() 返回设计单位下的可视矩形（view.ts:354 + view.ts:474-475 除以 scale）；
// FIXED_WIDTH 下 720 宽恒占满屏幕，所以横向布局只能落在 ±360 内，纵向则按真实高度铺。
// W10-3 起只收口了宽度，W11-3 把设计帧从 1280×720 换成 720×1280 并补齐横排区间派生。
import { view } from 'cc';

/** 设计帧兜底值：与 settings/v2/packages/project.json 的 general.designResolution 保持一致。 */
export const DESIGN_W = 720;
export const DESIGN_H = 1280;

/** 一排等宽按钮的横向几何：x0 为首枚按钮中心，step 为相邻中心距。 */
export interface RowSpan {
  width: number;
  x0: number;
  gap: number;
  step: number;
}

export function screenWidth(): number {
  return view.getVisibleSize().width || DESIGN_W;
}

export function screenHeight(): number {
  return view.getVisibleSize().height || DESIGN_H;
}

/** 宽度不超过可视宽度减去左右留白；720 帧下正文类元素的实际上限是 680。 */
export function fitWidth(authored: number, sidePadding = 40): number {
  return Math.min(authored, Math.max(240, screenWidth() - sidePadding * 2));
}

/** 贴右边界的锚点 x（按钮列、立绘）；half 为该内容自身半宽。 */
export function rightEdgeX(half: number, margin = 40): number {
  return screenWidth() / 2 - margin - half;
}

/** 贴左边界的锚点 x（免责句等左下角文本）。 */
export function leftEdgeX(half: number, margin = 20): number {
  return -screenWidth() / 2 + margin + half;
}

/**
 * 把 count 枚等宽按钮铺进 [left, right] 区间：治 疗页三组选项共用同一区间，
 * 因此行宽一致；选项数量少于列数时从左侧起排，不居中，避免行与行错位。
 */
export function fitRow(count: number, left: number, right: number, gap = 16): RowSpan {
  const n = Math.max(1, count);
  const width = Math.max(80, (right - left - gap * (n - 1)) / n);
  return { width, x0: left + width / 2, gap, step: width + gap };
}
