// STATUS: implemented, W16 P0 L0/L1 环境底板（墙 / 地 / 踢脚线零贴图 + 装饰占位，ui 分包就绪后换贴图）
import { Color, Graphics, Node, UITransform } from 'cc';
import { applySprite } from './PanelSprite';
import { screenHeight, screenWidth } from './ScreenMetrics';
import { COLORS, HEX, tint } from './Tokens';
import { ensureFrame } from './UiAssets';

export type BackdropVariant = 'clinic' | 'lobby' | 'room' | 'lab' | 'result';

/** 装饰图长宽比（与 scripts/pet-art.js 的输出尺寸一致），占位与贴图同尺寸，换图不跳位。 */
const DECOR_ASPECT: Record<string, number> = {
  ui_desk: 2,
  ui_plant: 1,
  ui_cushion: 1.714,
  ui_logo: 1.716,
};

const DECOR_FILL: Record<string, string> = {
  ui_desk: '#C9A67F',
  ui_plant: '#A8C3A0',
  ui_cushion: '#F3E3C8',
  ui_logo: '#E7D3B3',
};

/** 墙地交界线：装饰件的落脚点都按这条线算，换机型和换背景都对齐。 */
export function floorLineY(variant: BackdropVariant): number {
  const h = screenHeight();
  return -h / 2 + h * (variant === 'lobby' ? 0.3 : 0.26);
}

/** 每页进场景先 mountBackdrop，再把自己的卡片/按钮挂上去。 */
export function mountBackdrop(parent: Node, variant: BackdropVariant): Node {
  const root = new Node('Backdrop');
  root.parent = parent;
  const w = screenWidth();
  const h = screenHeight();
  const top = h / 2;
  const floorY = floorLineY(variant);
  const wallColor = variant === 'lab' ? tint('#EDF1F0') : COLORS.wall;
  const floorColor = variant === 'lab' ? tint('#DCE3E1') : COLORS.floor;
  addBand(root, 'Wall', (top + floorY) / 2, w, top - floorY, wallColor);
  addBand(root, 'Floor', (floorY - h / 2) / 2, w, floorY + h / 2, floorColor);
  addBand(root, 'Skirting', floorY + 7, w, 14, COLORS.skirt);
  if (variant === 'lobby' || variant === 'clinic') {
    addBand(root, 'WallTrim', top - 96, w, 8, new Color(255, 255, 255, 90));
  }
  if (variant === 'result') {
    addBand(root, 'Glow', 40, w, 300, new Color(255, 246, 226, 70));
  }
  return root;
}

function addBand(parent: Node, name: string, y: number, width: number, height: number, color: Color): Node {
  const node = new Node(name);
  node.parent = parent;
  node.setPosition(0, y, 0);
  node.addComponent(UITransform).setContentSize(width, Math.max(1, height));
  const graphics = node.addComponent(Graphics);
  graphics.fillColor = color;
  graphics.rect(-width / 2, -height / 2, width, Math.max(1, height));
  graphics.fill();
  return node;
}

/** 装饰件：先画同尺寸占位色块，贴图到了原地替换，不用重建节点。 */
export function addDecor(parent: Node, frameName: string, y: number, width: number, x = 0): Node {
  const aspect = DECOR_ASPECT[frameName] ?? 1;
  const height = width / aspect;
  const node = new Node(`Decor_${frameName}`);
  node.parent = parent;
  node.setPosition(x, y, 0);
  node.addComponent(UITransform).setContentSize(width, height);
  const graphics = node.addComponent(Graphics);
  graphics.fillColor = tint(DECOR_FILL[frameName] ?? HEX.paper);
  graphics.roundRect(-width / 2, -height / 2, width, height, 18);
  graphics.fill();
  ensureFrame(frameName, (frame) => {
    if (!node.isValid || !frame) {
      return;
    }
    applySprite(node, frame, Color.WHITE, false);
  });
  return node;
}

/** 标题 logo：与装饰同一条升级路径，只是额外带一层极淡的底光。 */
export function addLogo(parent: Node, y: number, width: number, x = 0): Node {
  addBand(parent, 'LogoGlow', y, width * 0.86, width * 0.3, new Color(255, 250, 238, 60));
  return addDecor(parent, 'ui_logo', y, width, x);
}
