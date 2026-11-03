// STATUS: implemented, W25-P0C5 图鉴双列虚拟列表（只保留可见行 ±4，滚动时增删）
import { Mask, Node, ScrollView, UITransform } from 'cc';
import { PetConfigItem } from '../config/CharacterConfig';
import { createNode } from './SceneUI';
import { buildCodexCard, CARD_H, CARD_W } from './CodexCard';

const VIEW_H = 380;
const ROW_H = CARD_H + 8;
const COL_GAP = 12;
const BUFFER_ROWS = 4;

/** 卡片数会随品种扩充增长，列表只养可见行；偏移取自 ScrollView 自己的边界值。 */
export function mountCodexList(parent: Node, pets: readonly PetConfigItem[], listW: number): void {
  const columns = listW >= CARD_W * 2 + COL_GAP ? 2 : 1;
  const rows = Math.ceil(pets.length / columns);
  const scrollNode = createNode(parent, 'CodexScroll', 0, listW, VIEW_H);
  const scroll = scrollNode.addComponent(ScrollView);
  const view = createNode(scrollNode, 'view', 0, listW, VIEW_H);
  view.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
  const content = new Node('content');
  content.parent = view;
  const transform = content.addComponent(UITransform);
  transform.setContentSize(listW, Math.max(VIEW_H, rows * ROW_H));
  transform.setAnchorPoint(0.5, 1);
  content.setPosition(0, VIEW_H / 2, 0);

  const colX = (CARD_W + COL_GAP) / 2;
  const live = new Map<number, Node[]>();
  const spawn = (row: number): void => {
    if (live.has(row)) {
      return;
    }
    const nodes: Node[] = [];
    for (let col = 0; col < columns; col++) {
      const pet = pets[row * columns + col];
      if (!pet) {
        break;
      }
      const x = columns === 2 ? (col === 0 ? -colX : colX) : 0;
      nodes.push(buildCodexCard(content, pet, x, -row * ROW_H - ROW_H / 2));
    }
    live.set(row, nodes);
  };
  const sync = (): void => {
    const scrolled = Math.max(0, scroll.getScrollOffset().y);
    const first = Math.max(0, Math.floor(scrolled / ROW_H) - BUFFER_ROWS);
    const last = Math.min(rows - 1, Math.floor((scrolled + VIEW_H) / ROW_H) + BUFFER_ROWS);
    live.forEach((_, row) => {
      if (row < first || row > last) {
        live.get(row)?.forEach((node) => node.destroy());
        live.delete(row);
      }
    });
    for (let row = first; row <= last; row++) {
      spawn(row);
    }
  };
  scrollNode.on(ScrollView.EventType.SCROLLING, sync);
  scroll.content = content;
  scroll.vertical = true;
  scroll.horizontal = false;
  scroll.brake = 0.72;
  sync();
}
