// STATUS: implemented, W17-3 立绘外围绘制（地面阴影 + 缺图占位），从 PetVisual 拆出以守住单文件 150 行
// W20-3 模块二：占位色改取 pets.json 的 baseLook，缺图时也能一眼分辨品种。
import { Color, Graphics, Label, Node, Tween, tween, UITransform, Vec3 } from 'cc';
import { CharacterConfig, LookShape } from '../config/CharacterConfig';
import { Quality } from '../config/Quality';
import { addLabel, hexToColor, PALETTE } from '../ui/SceneUI';
import { DURATION } from '../ui/Tokens';

export interface PlaceholderLook {
  color: Color;
  shape: LookShape;
}

/** 配置没读到时（启动极早期或未登记品种）用的中性色。 */
const NEUTRAL_LOOK: PlaceholderLook = { color: new Color(226, 220, 211, 255), shape: 'circle' };
/** 近白品种（棉花糖 / 笑笑 / 雪球）原色相差不到 20，占位色会被看成同一个；按最小色距拉伸。 */
const MIN_CHROMA_SPREAD = 46;

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function mix(color: Color, amount: number): Color {
  const target = 255;
  return new Color(
    clampChannel(color.r + (target - color.r) * amount),
    clampChannel(color.g + (target - color.g) * amount),
    clampChannel(color.b + (target - color.b) * amount),
    255,
  );
}

function shade(color: Color, factor: number): Color {
  return new Color(clampChannel(color.r * factor), clampChannel(color.g * factor), clampChannel(color.b * factor), 255);
}

function boostChroma(color: Color): Color {
  const max = Math.max(color.r, color.g, color.b);
  const min = Math.min(color.r, color.g, color.b);
  const spread = max - min;
  if (spread === 0 || spread >= MIN_CHROMA_SPREAD) {
    return color;
  }
  const mid = (max + min) / 2;
  const scale = MIN_CHROMA_SPREAD / spread;
  return new Color(
    clampChannel(mid + (color.r - mid) * scale),
    clampChannel(mid + (color.g - mid) * scale),
    clampChannel(mid + (color.b - mid) * scale),
    255,
  );
}

/** 品种 → 占位外观：色取 baseLook.color，形取 baseLook.shape（circle 用大圆角，square 用常规圆角）。 */
export function petPlaceholderLook(petId: string): PlaceholderLook {
  const item = CharacterConfig.petById(petId);
  if (!item) {
    return NEUTRAL_LOOK;
  }
  return { color: boostChroma(hexToColor(item.baseLook.color, NEUTRAL_LOOK.color)), shape: item.baseLook.shape };
}

/** 阴影是独立节点：横向轻微呼吸，制造 2.5D 的贴地感；low 档只画静态椭圆。 */
export function buildShadow(parent: Node, size: number): Node {
  const node = new Node('Shadow');
  node.parent = parent;
  node.setPosition(0, -size * 0.42, 0);
  node.addComponent(UITransform).setContentSize(size, size * 0.16);
  const graphics = node.addComponent(Graphics);
  graphics.fillColor = new Color(0, 0, 0, 38);
  graphics.ellipse(0, 0, size * 0.28, size * 0.07);
  graphics.fill();
  startShadowBreath(node);
  return node;
}

/** 呼吸循环单独成函数：抚摸时先停下、压一下再把它接回来，否则阴影会僵在半途。 */
export function startShadowBreath(node: Node): void {
  if (Quality.low) {
    return;
  }
  Tween.stopAllByTarget(node);
  node.setScale(Vec3.ONE);
  tween(node)
    .to(1.1, { scale: new Vec3(1.06, 1, 1) })
    .to(1.1, { scale: Vec3.ONE })
    .union()
    .repeatForever()
    .start();
}

/** 抚摸时阴影跟着压一下再交回呼吸；放在这里是为了守住 PetVisual 的单文件行数。 */
export function pulseShadow(node: Node | null): void {
  if (!node || Quality.low) {
    return;
  }
  Tween.stopAllByTarget(node);
  tween(node)
    .to(DURATION.squashIn, { scale: new Vec3(1.08, 1, 1) }, { easing: 'quadOut' })
    .to(DURATION.squashOut, { scale: Vec3.ONE }, { easing: 'backOut' })
    .call(() => startShadowBreath(node))
    .start();
}

/** 缺图兜底：两层圆角矩形叠出柔和过渡；小尺寸缩略图只画色块，不塞文字。 */
export function buildPlaceholder(
  parent: Node,
  artSize: number,
  look: PlaceholderLook = NEUTRAL_LOOK,
): { node: Node; label: Label; repaint: (next: PlaceholderLook) => void } {
  const node = new Node('Placeholder');
  node.parent = parent;
  node.addComponent(UITransform).setContentSize(artSize, artSize);
  const graphics = node.addComponent(Graphics);
  paintPlaceholder(graphics, artSize, look);
  // 图鉴缩略图只有 72 见方，字号跟着缩到 14 仍然可读；大立绘用 20。
  const label = addLabel(node, 'PlaceholderText', '加载中…', -artSize * 0.72 * 0.06, {
    size: artSize < 120 ? 14 : 20,
    color: PALETTE.sub,
    width: artSize * 0.9,
  });
  return { node, label, repaint: (next) => paintPlaceholder(graphics, artSize, next) };
}

/** 外块压深、内块提亮，同一只宠物的占位色只由 baseLook 决定；贴图到位后这块会被直接销毁。 */
function paintPlaceholder(graphics: Graphics, artSize: number, look: PlaceholderLook): void {
  const width = artSize * 0.9;
  const height = artSize * 0.72;
  const base = Math.min(width, height);
  const radius = look.shape === 'circle' ? base * 0.46 : base * 0.18;
  graphics.clear();
  graphics.fillColor = mix(look.color, 0.12);
  graphics.roundRect(-width / 2, -height / 2, width, height, radius);
  graphics.fill();
  // 白色系品种（萨摩耶 / 比熊）提亮后和奶油色卡片几乎同色，补一圈同色相深色描边把轮廓找回来。
  graphics.lineWidth = Math.max(2, artSize * 0.02);
  graphics.strokeColor = shade(look.color, 0.62);
  graphics.roundRect(-width / 2, -height / 2, width, height, radius);
  graphics.stroke();
  graphics.fillColor = mix(look.color, 0.55);
  graphics.roundRect(-width / 2 + 6, -height / 2 + height * 0.44, width - 12, height * 0.46, radius * 0.7);
  graphics.fill();
}
