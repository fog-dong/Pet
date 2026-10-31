// STATUS: implemented, W18 拍片灯箱（深色胶片 + 白色骨骼简笔画 + 噪点；红色病灶由 XrayBoard 叠加）
import { Color, Graphics, Node } from 'cc';
import { createBox, paintRound, sliceNode } from '../ui/PanelKit';

const WOOD = new Color(196, 158, 118, 255);
const BACKLIGHT = new Color(8, 11, 16, 255);
const FILM = new Color(16, 22, 30, 255);
const BONE = new Color(232, 240, 246, 214);
const BONE_SOFT = new Color(232, 240, 246, 74);

/** 灯箱：外木框、深色背板、近黑胶片；返回最外层节点，骨廓/病灶/放大镜都以它为坐标系。 */
export function buildLightbox(parent: Node, name: string, width: number, height: number): Node {
  const frame = createBox(parent, name, 0, width, height);
  paintRound(frame, width, height, 24, WOOD);
  sliceNode(frame, 'ui_panel_wood', WOOD);

  const backW = width - 24;
  const backH = height - 24;
  const back = createBox(frame, 'XrayBacklight', 0, backW, backH);
  paintRound(back, backW, backH, 18, BACKLIGHT);

  const filmW = width - 56;
  const filmH = height - 68;
  const film = createBox(frame, 'XrayFilm', 0, filmW, filmH);
  const graphics = paintRound(film, filmW, filmH, 14, FILM);
  paintBones(graphics, filmW, filmH);
  paintNoise(graphics, filmW, filmH);
  return frame;
}

/** 正位胸片简笔画：椎体链 + 锁骨 + 六对肋骨 + 骨盆弧，全部白色半透明线条。 */
function paintBones(graphics: Graphics, w: number, h: number): void {
  const spineTop = h * 0.3;
  const halfW = w * 0.34;
  // 椎体链：一节节圆角块比一条直线更像片子。
  graphics.fillColor = BONE;
  for (let i = 0; i < 7; i += 1) {
    const y = spineTop - i * (h * 0.082);
    graphics.roundRect(-10, y - 12, 20, 24, 6);
    graphics.fill();
  }
  // 锁骨：从颈根向两侧展开。
  graphics.strokeColor = BONE;
  graphics.lineWidth = 6;
  for (const sign of [-1, 1]) {
    graphics.moveTo(sign * 12, spineTop + 8);
    graphics.bezierCurveTo(sign * 76, spineTop + 18, sign * halfW * 0.82, spineTop + 4, sign * halfW * 0.98, spineTop - 22);
    graphics.stroke();
  }
  // 肋骨：贴着椎体向外下扫，左右各 6 根。
  graphics.lineWidth = 4;
  for (let i = 0; i < 6; i += 1) {
    const y = spineTop - 16 - i * (h * 0.082);
    const reach = halfW * (1 - i * 0.07);
    for (const sign of [-1, 1]) {
      graphics.moveTo(sign * 12, y);
      graphics.bezierCurveTo(sign * 78, y + 14, sign * reach * 0.9, y - 6, sign * reach, y - 52);
      graphics.stroke();
    }
  }
  // 骨盆与软组织：软线勾边，避免整张片子只有骨架。
  graphics.strokeColor = BONE_SOFT;
  graphics.lineWidth = 5;
  for (const sign of [-1, 1]) {
    graphics.moveTo(0, -h * 0.34);
    graphics.bezierCurveTo(sign * halfW * 0.5, -h * 0.36, sign * halfW * 0.92, -h * 0.22, sign * halfW * 0.8, -h * 0.02);
    graphics.stroke();
  }
  // 心影：偏左的淡白团块，让画面有层次。
  graphics.fillColor = new Color(232, 240, 246, 34);
  graphics.moveTo(-10, h * 0.02);
  graphics.bezierCurveTo(-70, h * 0.05, -96, -h * 0.12, -58, -h * 0.22);
  graphics.bezierCurveTo(-30, -h * 0.28, 6, -h * 0.2, 4, -h * 0.06);
  graphics.bezierCurveTo(4, -h * 0.02, 0, 0, -10, h * 0.02);
  graphics.fill();
}

/** 固定种子的胶片噪点：每次进场景颗粒分布一致，不会闪烁。 */
function paintNoise(graphics: Graphics, w: number, h: number): void {
  let seed = 20261031;
  const next = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < 110; i += 1) {
    const x = (next() - 0.5) * (w - 14);
    const y = (next() - 0.5) * (h - 14);
    const radius = 0.7 + next() * 1.5;
    graphics.fillColor = new Color(255, 255, 255, 18 + Math.floor(next() * 40));
    graphics.circle(x, y, radius);
    graphics.fill();
  }
}
