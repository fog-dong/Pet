// STATUS: implemented, W25 P1-B 拍片刮擦手势（透明命中层 → 胶片局部坐标，按步长回报擦雾）
import { EventTouch, Node, UITransform, Vec3 } from 'cc';

const STEP = 12;

export interface XrayWipeHooks {
  active(): boolean;
  film(): Node | null;
  onWipe(x: number, y: number): void;
}

function toFilmLocal(film: Node, event: EventTouch): Vec3 {
  const ui = event.getUILocation();
  const world = new Vec3(ui.x, ui.y, 0);
  const transform = film.getComponent(UITransform);
  return transform ? transform.convertToNodeSpaceAR(world) : world;
}

/** 累计移动超过 STEP 才回报一次，避免同一片雾在一帧里被反复清。 */
export function bindXrayWipe(layer: Node, hooks: XrayWipeHooks): void {
  let last: Vec3 | null = null;
  const emit = (event: EventTouch): void => {
    if (!hooks.active()) {
      return;
    }
    const film = hooks.film();
    if (!film) {
      return;
    }
    const point = toFilmLocal(film, event);
    if (last && Math.hypot(point.x - last.x, point.y - last.y) < STEP) {
      return;
    }
    last = point;
    hooks.onWipe(point.x, point.y);
  };
  layer.on(Node.EventType.TOUCH_START, emit);
  layer.on(Node.EventType.TOUCH_MOVE, emit);
  layer.on(Node.EventType.TOUCH_END, () => {
    last = null;
  });
  // 指针滑出胶片范围时浏览器改发 touchcancel，同样要清掉起点，否则下一次起点会跳。
  layer.on(Node.EventType.TOUCH_CANCEL, () => {
    last = null;
  });
}
