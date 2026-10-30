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

  constructor(hooks: LabDragHooks) {
    this.hooks = hooks;
  }

  bind(card: LabCard): void {
    const node = card.node;
    node.on(Node.EventType.TOUCH_START, () => {
      if (!this.hooks.active()) {
        return;
      }
      this.dragging = card;
      this.hooks.onHint('拖到右侧对应的试剂上');
    });
    node.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => this.move(event));
    node.on(Node.EventType.TOUCH_END, (event: EventTouch) => this.drop(event));
    node.on(Node.EventType.TOUCH_CANCEL, () => {
      this.dragging = null;
      clearDrag(this.hooks.layer());
    });
  }

  private move(event: EventTouch): void {
    const card = this.dragging;
    const layer = this.hooks.layer();
    if (!card || !layer || !this.hooks.active()) {
      return;
    }
    const ui = event.getUILocation();
    drawDrag(layer, card.node.getWorldPosition(), new Vec3(ui.x, ui.y, 0));
  }

  private drop(event: EventTouch): void {
    const card = this.dragging;
    this.dragging = null;
    clearDrag(this.hooks.layer());
    if (!card || !this.hooks.active()) {
      return;
    }
    const ui = event.getUILocation();
    const target = this.hooks.reagents().find((reagent) => !reagent.matched && containsPoint(reagent.node, ui));
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
