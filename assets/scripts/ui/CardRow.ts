// STATUS: implemented, W16 P0 选项卡行（治疗三组 / 接诊选项共用：选中描边 + 1.02 放大，无贴图时仍是圆角纸卡）
import { Color, Graphics, Label, Node, tween, Vec3 } from 'cc';
import { makeLabel } from './FontKit';
import { addCard } from './PanelKit';
import { COLORS, RADIUS } from './Tokens';

export interface CardRowOptions {
  y: number;
  width: number;
  height?: number;
  gap?: number;
  x?: number;
  fontSize?: number;
  selectedColor?: Color;
}

export interface CardRowHandle {
  root: Node;
  cards: Node[];
  select(index: number): void;
  selected(): number;
}

const SELECT_SCALE = 1.02;

export function addCardRow(
  parent: Node,
  name: string,
  labels: readonly string[],
  options: CardRowOptions,
): CardRowHandle {
  const height = options.height ?? 72;
  const gap = options.gap ?? 16;
  const count = Math.max(1, labels.length);
  const step = options.width + gap;
  const root = new Node(name);
  root.parent = parent;
  root.setPosition(options.x ?? 0, options.y, 0);
  const accent = options.selectedColor ?? COLORS.clay;
  const rings: Node[] = [];
  const cards: Node[] = [];
  let current = -1;

  labels.forEach((text, index) => {
    const x = (index - (count - 1) / 2) * step;
    const card = addCard(root, `${name}${index}`, 0, options.width, height, { x });
    makeLabel(card, `${name}Label${index}`, text, 0, {
      size: options.fontSize ?? 26,
      width: options.width - 32,
    });
    const ring = new Node(`${name}Ring${index}`);
    ring.parent = card;
    ring.addComponent(Graphics);
    drawRing(ring, options.width, height, accent);
    ring.active = false;
    rings.push(ring);
    cards.push(card);
  });

  const handle: CardRowHandle = {
    root,
    cards,
    select(index: number): void {
      current = index;
      cards.forEach((card, i) => {
        const on = i === index;
        rings[i].active = on;
        const target = on ? SELECT_SCALE : 1;
        const label = card.getChildByName(`${name}Label${i}`)?.getComponent(Label);
        if (label) {
          label.color = on ? accent : COLORS.ink;
        }
        tween(card)
          .to(0.15, { scale: new Vec3(target, target, 1) }, { easing: 'sineOut' })
          .start();
      });
    },
    selected(): number {
      return current;
    },
  };
  return handle;
}

/** 选中描边：优先用同尺寸圆角线框，比换底色更克制。 */
export function drawRing(node: Node, width: number, height: number, color: Color): void {
  const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics);
  graphics.clear();
  graphics.lineWidth = 3;
  graphics.strokeColor = color;
  graphics.roundRect(-width / 2 + 1.5, -height / 2 + 1.5, width - 3, height - 3, RADIUS.card);
  graphics.stroke();
}
