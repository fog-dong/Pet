// STATUS: implemented, W4 拍片拖拽手势（只负责移动标记框，命中判定交给 Xray）
import { EventTouch, Node, UITransform, Vec3 } from 'cc';

export interface XrayDragHooks {
  active(): boolean;
  board(): Node | null;
  marker(): Node | null;
  onDrop(): void;
  onCancel(): void;
}

function toBoardLocal(board: Node, event: EventTouch): Vec3 {
  const ui = event.getUILocation();
  const transform = board.getComponent(UITransform);
  const point = new Vec3(ui.x, ui.y, 0);
  return transform ? transform.convertToNodeSpaceAR(point) : point;
}

/** 松手时调用 onDrop，由 Xray 自行做距离判定与计时扣减。 */
export function bindXrayDrag(marker: Node, hooks: XrayDragHooks): void {
  let dragging = false;
  marker.on(Node.EventType.TOUCH_START, () => {
    dragging = true;
  });
  marker.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => {
    const board = hooks.board();
    const node = hooks.marker();
    if (!dragging || !hooks.active() || !board || !node) {
      return;
    }
    const local = toBoardLocal(board, event);
    node.setPosition(local.x, local.y, 0);
  });
  marker.on(Node.EventType.TOUCH_END, () => {
    dragging = false;
    hooks.onDrop();
  });
  marker.on(Node.EventType.TOUCH_CANCEL, () => {
    dragging = false;
    hooks.onCancel();
  });
}
