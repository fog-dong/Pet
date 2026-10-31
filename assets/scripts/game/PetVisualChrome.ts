// STATUS: implemented, W17-3 立绘外围绘制（地面阴影 + 缺图占位），从 PetVisual 拆出以守住单文件 150 行
import { Color, Graphics, Label, Node, tween, UITransform, Vec3 } from 'cc';
import { Quality } from '../config/Quality';
import { addLabel, PALETTE } from '../ui/SceneUI';

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
  if (Quality.low) {
    return node;
  }
  tween(node)
    .to(1.1, { scale: new Vec3(1.06, 1, 1) })
    .to(1.1, { scale: Vec3.ONE })
    .union()
    .repeatForever()
    .start();
  return node;
}

/** 缺图兜底：两层圆角矩形叠出柔和过渡；小尺寸缩略图只画色块，不塞文字。 */
export function buildPlaceholder(parent: Node, artSize: number): { node: Node; label: Label } {
  const node = new Node('Placeholder');
  node.parent = parent;
  node.addComponent(UITransform).setContentSize(artSize, artSize);
  const width = artSize * 0.9;
  const height = artSize * 0.72;
  const radius = Math.min(width, height) * 0.18;
  const graphics = node.addComponent(Graphics);
  graphics.fillColor = new Color(226, 220, 211, 255);
  graphics.roundRect(-width / 2, -height / 2, width, height, radius);
  graphics.fill();
  graphics.fillColor = new Color(240, 236, 229, 255);
  graphics.roundRect(-width / 2 + 6, -height / 2 + height * 0.44, width - 12, height * 0.46, radius * 0.7);
  graphics.fill();
  // 图鉴缩略图只有 72 见方，字号跟着缩到 14 仍然可读；大立绘用 20。
  const label = addLabel(node, 'PlaceholderText', '加载中…', -height * 0.06, {
    size: artSize < 120 ? 14 : 20,
    color: PALETTE.sub,
    width,
  });
  return { node, label };
}
