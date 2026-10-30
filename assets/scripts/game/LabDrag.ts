// STATUS: implemented, W4 化验拖拽连线（只负责手势与连线绘制，配对结果交给 Lab）
import { EventTouch, Graphics, Node, Vec3 } from 'cc';
import { clearDrag, containsPoint, drawDrag, LabCard } from './LabView';

export interface LabDragHooks {
  active(): boolean;
  layer(): Graphics | null;
  reagents(): LabCard[];
  expected(sample: string): string;
  onMatch(sample: LabCard, reagent: LabCard): void;
  onMiss(sample: LabCard, reagent: LabCard): void;
  onEmpty(): void;
  onHint(text: string): void;
}

export class LabDrag {
  private readonly hooks: LabDragHooks;
  private dragging: LabCard | null = null;
  private lastUi: { x: number; y: number } | null = null;

  constructor(hooks: LabDragHooks) {
    this.hooks = hooks;
  }

  bind(card: LabCard): void {
    const node = card.node;
    node.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
      if (!this.hooks.active()) {
        return;
      }
      this.dragging = card;
      this.lastUi = event.getUILocation();
      this.hooks.onHint('拖到右侧对应的试剂上');
    });
    node.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => {
      this.lastUi = event.getUILocation();
      this.move(event);
    });
    node.on(Node.EventType.TOUCH_END, (event: EventTouch) => this.dropAt(event.getUILocation()));
    // 浏览器/预览器常在指针离开卡片后把 touchend 变成 touchcancel，按最后落点判定，避免白拖一次。
    node.on(Node.EventType.TOUCH_CANCEL, (event: EventTouch) => {
      this.dropAt(this.lastUi ?? event.getUILocation());
    });
  }

  private move(event: EventTouch): void {
    const card = this.dragging;
    const layer = this.hooks.layer();
    if (!card || !layer || !this.hooks.active()) {
      return;
    }
    const ui = event.getUILocation();
    // 起点是卡片中心的世界坐标，终点是手指当前位置：getUILocation 本身就是世界坐标，补 z 即可。
    drawDrag(layer, card.node.getWorldPosition(), new Vec3(ui.x, ui.y, 0));
  }

  private dropAt(ui: { x: number; y: number }): void {
    const card = this.dragging;
    this.dragging = null;
    this.lastUi = null;
    clearDrag(this.hooks.layer());
    if (!card || !this.hooks.active()) {
      return;
    }
    const world = new Vec3(ui.x, ui.y, 0);
    const target = this.hooks.reagents().find((reagent) => !reagent.matched && containsPoint(reagent.node, world));
    if (!target) {
      this.hooks.onEmpty();
      return;
    }
    if (this.hooks.expected(card.name) === target.name) {
      this.hooks.onMatch(card, target);
      return;
    }
    this.hooks.onMiss(card, target);
  }
}
