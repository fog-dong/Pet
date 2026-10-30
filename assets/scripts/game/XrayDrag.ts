// STATUS: implemented, W4 拍片拖拽手势（只负责移动标记框，命中判定交给 Xray）
import { EventTouch, Node, UITransform, Vec3 } from 'cc';

export interface XrayDragHooks {
  active(): boolean;
  board(): Node | null;
  marker(): Node | null;
  onDrop(): void;
}

function toBoardLocal(board: Node, event: EventTouch): Vec3 {
  // getUILocation 已是设计分辨率下的世界坐标（左下原点、设计单位），补 z 后直接交给 convertToNodeSpaceAR。
  const ui = event.getUILocation();
  const world = new Vec3(ui.x, ui.y, 0);
  const transform = board.getComponent(UITransform);
  return transform ? transform.convertToNodeSpaceAR(world) : world;
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
  // 指针离开标记框后浏览器会改发 touchcancel，按当前框位判定，否则松手不生效。
  marker.on(Node.EventType.TOUCH_CANCEL, () => {
    dragging = false;
    hooks.onDrop();
  });
}
