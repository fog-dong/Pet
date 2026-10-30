// STATUS: implemented, W16 P0 九宫格 Sprite 落位（子节点承载，父节点 Graphics 保持兜底）
import { Color, Graphics, Node, Sprite, SpriteFrame, UITransform } from 'cc';

const SPRITE_CHILD = 'Sliced';

/**
 * 一个节点只能挂一个 UI 渲染器：引擎会拒绝第二个，uiProps.uiComp 仍指回先挂的 Graphics，
 * 后挂的 Sprite 因此永远进不了渲染批次。所以九宫格 Sprite 放在子节点上。
 */
export function applySprite(node: Node, frame: SpriteFrame, color: Color, sliced: boolean): void {
  let host = node.getChildByName(SPRITE_CHILD);
  if (!host) {
    host = new Node(SPRITE_CHILD);
    host.layer = node.layer;
    host.parent = node;
    host.setSiblingIndex(0);
  }
  const size = node.getComponent(UITransform)?.contentSize;
  const transform = host.getComponent(UITransform) ?? host.addComponent(UITransform);
  transform.setContentSize(size?.width ?? frame.width, size?.height ?? frame.height);
  const sprite = host.getComponent(Sprite) ?? host.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.type = sliced ? Sprite.Type.SLICED : Sprite.Type.SIMPLE;
  sprite.trim = false;
  sprite.spriteFrame = frame;
  sprite.color = color;
  node.getComponent(Graphics)?.clear();
}
