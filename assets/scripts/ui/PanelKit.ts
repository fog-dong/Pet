// STATUS: implemented, W16 P0 圆角卡片 / 胶囊 / 软投影（无贴图时回退 Graphics，外观与旧版一致）
import { Color, Graphics, Node, UITransform } from 'cc';
import { applySprite } from './PanelSprite';
import { COLORS, RADIUS } from './Tokens';
import { ensureFrame } from './UiAssets';

export interface BoxOptions {
  radius?: number;
  color?: Color;
  frame?: string;
  shadow?: boolean;
  x?: number;
}

export function createBox(
  parent: Node,
  name: string,
  y: number,
  width: number,
  height: number,
  x = 0,
): Node {
  const node = new Node(name);
  node.parent = parent;
  node.setPosition(x, y, 0);
  node.addComponent(UITransform).setContentSize(width, height);
  return node;
}

/** 圆角实心矩形（降级外观）。 */
export function paintRound(
  node: Node,
  width: number,
  height: number,
  radius: number,
  color: Color,
): Graphics {
  const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics);
  graphics.clear();
  graphics.fillColor = color;
  graphics.roundRect(-width / 2, -height / 2, width, height, radius);
  graphics.fill();
  return graphics;
}

/** 在 anchor 同层插入一层黑色圆角影子，随 anchor 一起被页面移动。 */
export function addShadow(
  parent: Node,
  anchor: Node,
  width: number,
  height: number,
  radius: number,
  dy = 6,
  alpha = 58,
): Node {
  const shadow = createBox(parent, `${anchor.name}Shadow`, anchor.position.y - dy, width, height, anchor.position.x);
  shadow.setSiblingIndex(anchor.getSiblingIndex());
  paintRound(shadow, width, height, radius, new Color(0, 0, 0, alpha));
  ensureFrame('ui_shadow_round', (frame) => {
    if (!shadow.isValid) {
      return;
    }
    if (!frame) {
      return;
    }
    applySprite(shadow, frame, new Color(0, 0, 0, Math.round((alpha / 255) * 255)), false);
  });
  return shadow;
}

/** 贴九宫格底：先保留 Graphics，等 ui 分包回来再换成 Sprite（失败则什么都不做）。 */
export function sliceNode(node: Node, frameName: string, color: Color, sliced = true): void {
  ensureFrame(frameName, (frame) => {
    if (!node.isValid) {
      return;
    }
    if (!frame) {
      return;
    }
    applySprite(node, frame, color, sliced);
  });
}

export function addCard(
  parent: Node,
  name: string,
  y: number,
  width: number,
  height: number,
  options: BoxOptions = {},
): Node {
  const radius = options.radius ?? RADIUS.card;
  const color = options.color ?? COLORS.paper;
  const node = createBox(parent, name, y, width, height, options.x ?? 0);
  if (options.shadow !== false) {
    addShadow(parent, node, width, height, radius);
  }
  paintRound(node, width, height, radius, color);
  sliceNode(node, options.frame ?? 'ui_panel_paper', color);
  return node;
}

/**
 * 胶囊条：Toast、资源 HUD、章节 chip 共用。
 * 用 Graphics 现画而不是贴图——高度随内容变化，拉伸贴图会把两端的半圆压扁。
 */
export function addPill(
  parent: Node,
  name: string,
  y: number,
  width: number,
  height: number,
  color: Color = COLORS.white,
  x = 0,
): Node {
  const node = createBox(parent, name, y, width, height, x);
  paintRound(node, width, height, height / 2, color);
  return node;
}

export function addDivider(parent: Node, y: number, width: number, color = COLORS.skirt): Node {
  const node = createBox(parent, 'Divider', y, width, 2);
  paintRound(node, width, 2, 1, color);
  return node;
}

export function addTitleBar(parent: Node, name: string, y: number, width: number, height = 56): Node {
  const node = createBox(parent, name, y, width, height);
  paintRound(node, width, height, 12, COLORS.skirt);
  sliceNode(node, 'ui_panel_wood', COLORS.white);
  return node;
}
