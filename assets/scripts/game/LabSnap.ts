// STATUS: implemented, W25 P1-B-3 化验吸附动效（松手点吸到卡槽中心 → 配对线 + 双卡发光）
import { Graphics, Node, tween, Vec3 } from 'cc';
import type { LabCard } from './LabView';
import { glowCard } from './LabGlow';
import { clearDrag, drawDrag, drawPair } from './LabLines';

const SNAP_SEC = 0.16;

/** 一次配对动效：终点从松手点滑到试剂卡中心，然后落线发光。from 缺省表示广告提示，直接落线。 */
export class LabSnap {
  private busy = false;
  private readonly parent: Node;
  private readonly layer: () => Graphics | null;
  private readonly onComplete: (sample: LabCard, reagent: LabCard) => void;

  constructor(parent: Node, layer: () => Graphics | null, onComplete: (sample: LabCard, reagent: LabCard) => void) {
    this.parent = parent;
    this.layer = layer;
    this.onComplete = onComplete;
  }

  get idle(): boolean {
    return !this.busy;
  }

  play(sample: LabCard, reagent: LabCard, from?: Vec3): void {
    if (this.busy || sample.matched || reagent.matched) {
      return;
    }
    this.busy = true;
    sample.matched = true;
    reagent.matched = true;
    const layer = this.layer();
    const start = sample.node.getWorldPosition();
    const end = reagent.node.getWorldPosition();
    const land = (): void => {
      this.busy = false;
      // 倒计时到点或中途退页时节点可能已销毁，动画结果直接作废。
      if (!layer || !layer.node.isValid) {
        return;
      }
      drawPair(this.parent, start, end);
      glowCard(sample);
      glowCard(reagent);
      clearDrag(layer);
      this.onComplete(sample, reagent);
    };
    if (!from || !layer) {
      land();
      return;
    }
    const fromWorld = from.clone();
    const proxy = { t: 0 };
    tween(proxy)
      .to(SNAP_SEC, { t: 1 }, {
        easing: 'quadOut',
        onUpdate: () => {
          if (!layer.node.isValid) {
            return;
          }
          const point = new Vec3(
            fromWorld.x + (end.x - fromWorld.x) * proxy.t,
            fromWorld.y + (end.y - fromWorld.y) * proxy.t,
            0,
          );
          drawDrag(layer, start, point);
        },
      })
      .call(land)
      .start();
  }
}
