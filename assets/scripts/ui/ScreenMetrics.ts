// STATUS: implemented, W10-3 屏幕级度量收口（全屏遮罩/面板/标签宽度一律从可视尺寸派生，不再硬编码 1280×720）
// 引擎口径：view.getVisibleSize() 返回设计单位下的可视矩形（view.ts:354 + view.ts:474-475 除以 scale）；
// FIXED_WIDTH（policy=4）下宽度恒等于设计宽、高度随屏幕比例变大，所以竖屏长屏必须先拿到真实高度。
import { view } from 'cc';

/** 设计帧兜底值：与 settings/v2/packages/project.json 的 general.designResolution 保持一致。 */
export const DESIGN_W = 1280;
export const DESIGN_H = 720;

export function screenWidth(): number {
  return view.getVisibleSize().width || DESIGN_W;
}

export function screenHeight(): number {
  return view.getVisibleSize().height || DESIGN_H;
}

/** 宽度不超过可视宽度减去左右留白；当前 1280 帧下所有既有字面量取原值，零视觉差异。 */
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
