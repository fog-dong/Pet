// STATUS: implemented, W18 化验拖拽连线（按住样本 → 绿线跟随手指 → 松开判定；失败卡片摇晃）
import { EventTouch, Graphics, Node, Vec3 } from 'cc';
import type { LabCard } from './LabView';
import { isInsideCard, isWithinMagnet } from './LabView';
import { clearDrag, drawDrag } from './LabLines';

export interface LabDragHooks {
  active(): boolean;
  layer(): Graphics | null;
  reagents(): LabCard[];
  expected(sample: string): string;
  /** from 是松手点，LabSnap 用它把线吸到卡槽中心。 */
  onMatch(sample: LabCard, reagent: LabCard, from: Vec3): void;
  onMiss(sample: LabCard, reagent: LabCard): void;
  onEmpty(): void;
  onHint(text: string): void;
}

/** 坐标口径：手指来自 getUILocation（与 UI 世界坐标一致），卡片中心取 getWorldPosition，再统一 convertToNodeSpaceAR。 */
function worldOf(event: EventTouch): Vec3 {
  const ui = event.getUILocation();
  return new Vec3(ui.x, ui.y, 0);
}

export class LabDrag {
  private readonly hooks: LabDragHooks;
  private dragging: LabCard | null = null;
  private lastWorld: Vec3 | null = null;

  constructor(hooks: LabDragHooks) {
    this.hooks = hooks;
  }

  bind(card: LabCard): void {
    const node = card.node;
    node.on(Node.EventType.TOUCH_START, (event: EventTouch) => this.begin(card, event));
    node.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => this.follow(event));
    node.on(Node.EventType.TOUCH_END, (event: EventTouch) => this.drop(worldOf(event)));
    // 浏览器/预览器在指针离开卡片后可能改发 touchcancel，按最后落点判定，避免白拖一次。
    node.on(Node.EventType.TOUCH_CANCEL, (event: EventTouch) => this.drop(this.lastWorld ?? worldOf(event)));
  }

  private begin(card: LabCard, event: EventTouch): void {
    if (!this.hooks.active() || card.matched) {
      return;
    }
    this.dragging = card;
    this.lastWorld = worldOf(event);
    this.hooks.onHint('按住样本拖到右侧对应的试剂上');
    this.paint(this.lastWorld);
  }

  private follow(event: EventTouch): void {
    if (!this.dragging) {
      return;
    }
    this.lastWorld = worldOf(event);
    this.paint(this.lastWorld);
  }

  private paint(to: Vec3): void {
    const card = this.dragging;
    const layer = this.hooks.layer();
    if (!card || !layer || !this.hooks.active()) {
      return;
    }
    // 起点固定在卡片中心（世界坐标），不是手指按下的偏移点。
    drawDrag(layer, card.node.getWorldPosition(), to);
  }

  private drop(world: Vec3): void {
    const card = this.dragging;
    const from = this.lastWorld ?? world;
    this.dragging = null;
    this.lastWorld = null;
    if (!card || !this.hooks.active()) {
      clearDrag(this.hooks.layer());
      return;
    }
    const hit = this.hooks.reagents().find((reagent) => !reagent.matched && isInsideCard(reagent.node, world));
    // 磁吸只对正确卡槽生效：松开在附近（外扩 46）也算连上，错槽仍按连错处理。
    const near = this.hooks.reagents().find(
      (reagent) =>
        !reagent.matched &&
        this.hooks.expected(card.name) === reagent.name &&
        isWithinMagnet(reagent.node, world),
    );
    const target = hit ?? near;
    if (!target) {
      clearDrag(this.hooks.layer());
      this.hooks.onEmpty();
      return;
    }
    if (this.hooks.expected(card.name) === target.name) {
      // 不清线：交给 LabSnap 从松手点吸到卡槽中心，动画结束再收线。
      this.hooks.onMatch(card, target, from);
      return;
    }
    clearDrag(this.hooks.layer());
    this.hooks.onMiss(card, target);
  }
}
