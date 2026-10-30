// STATUS: implemented, W17 拍片灯箱（木质边框 + 深灰内衬 + 浅蓝半透明胶片 + 噪点，替掉旧椭圆占位）
import { Color, Graphics, Node } from 'cc';
import { createBox, paintRound, sliceNode } from '../ui/PanelKit';

const WOOD = new Color(196, 158, 118, 255);
const BACKLIGHT = new Color(44, 49, 58, 255);
const FILM = new Color(206, 228, 242, 142);
const BODY = new Color(255, 255, 255, 34);
const SPINE = new Color(255, 255, 255, 44);
const RIB = new Color(255, 255, 255, 26);

/** 灯箱：外木框、内深灰板、最上层半透明胶片；返回最外层节点，病灶/标记仍以它为坐标系。 */
export function buildLightbox(parent: Node, name: string, width: number, height: number): Node {
  const frame = createBox(parent, name, 0, width, height);
  paintRound(frame, width, height, 24, WOOD);
  sliceNode(frame, 'ui_panel_wood', WOOD);

  const backW = width - 28;
  const backH = height - 28;
  const back = createBox(frame, 'XrayBacklight', 0, backW, backH);
  paintRound(back, backW, backH, 18, BACKLIGHT);

  const filmW = width - 56;
  const filmH = height - 68;
  const film = createBox(frame, 'XrayFilm', 0, filmW, filmH);
  const graphics = paintRound(film, filmW, filmH, 14, FILM);
  paintBody(graphics, filmW, filmH);
  paintNoise(graphics, filmW, filmH);
  return frame;
}

/** 侧位胸片式剪影：肩宽腹窄的躯干 + 脊柱带 + 四根肋骨弧，不用椭圆/十字这类冷几何。 */
function paintBody(graphics: Graphics, w: number, h: number): void {
  const halfW = w * 0.3;
  const top = h * 0.22;
  const bottom = -h * 0.36;
  graphics.fillColor = BODY;
  graphics.moveTo(-halfW * 0.55, top);
  graphics.bezierCurveTo(-halfW * 1.02, top - h * 0.03, -halfW * 1.12, -h * 0.02, -halfW * 0.85, -h * 0.18);
  graphics.bezierCurveTo(-halfW * 0.62, bottom + h * 0.02, -halfW * 0.3, bottom, 0, bottom);
  graphics.bezierCurveTo(halfW * 0.3, bottom, halfW * 0.62, bottom + h * 0.02, halfW * 0.85, -h * 0.18);
  graphics.bezierCurveTo(halfW * 1.12, -h * 0.02, halfW * 1.02, top - h * 0.03, halfW * 0.55, top);
  graphics.bezierCurveTo(halfW * 0.22, top + h * 0.02, -halfW * 0.22, top + h * 0.02, -halfW * 0.55, top);
  graphics.fill();

  graphics.strokeColor = SPINE;
  graphics.lineWidth = 10;
  graphics.moveTo(-halfW * 0.75, top - h * 0.06);
  graphics.bezierCurveTo(-halfW * 0.25, top - h * 0.01, halfW * 0.25, top - h * 0.01, halfW * 0.75, top - h * 0.06);
  graphics.stroke();

  // 肋骨从脊柱向两侧下扫，比横贯躯干的平行弧更像胸片。
  graphics.strokeColor = RIB;
  graphics.lineWidth = 4;
  for (let i = 0; i < 4; i += 1) {
    const y = top - h * 0.04 - i * h * 0.075;
    const reach = halfW * (0.86 - i * 0.05);
    for (const sign of [-1, 1]) {
      graphics.moveTo(sign * halfW * 0.06, y);
      graphics.bezierCurveTo(
        sign * halfW * 0.42,
        y + h * 0.015,
        sign * reach * 0.85,
        y - h * 0.04,
        sign * reach,
        y - h * 0.13,
      );
      graphics.stroke();
    }
  }
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
