// STATUS: implemented, W17-3 宠物行为状态机（五档循环位移 + 帧序列，缺资源或低画质退回静态姿态）
// 位移幅度受控：缩放 ≤1.06、旋转 ≤4°、位移 ≤12px，不让角色抢过页面主操作。
import { Node, SpriteFrame, Tween, tween, Vec3 } from 'cc';
import { Quality } from '../config/Quality';
import type { PetState } from './CharacterLook';
import { loadStateFrames } from './PetFrames';

/** 帧序列节奏：约 6 帧/秒，摇尾与跳跃不会显得卡顿。 */
const FRAME_INTERVAL_MS = 170;
const JUMP_HEIGHT = 12;

/** PetVisual 暴露给行为层的最小接口：能拿到被 tweens 的内容节点，能换帧。 */
export interface PetVisualHost {
  get contentNode(): Node | null;
  showFrame(frame: SpriteFrame): void;
}

export class PetBehavior {
  private readonly host: PetVisualHost;
  private state: PetState = 'idle';
  private frames: SpriteFrame[] = [];
  private index = 0;
  private token = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(host: PetVisualHost) {
    this.host = host;
  }

  get current(): PetState {
    return this.state;
  }

  /** 每次调用都重播：帧序列按缓存返回，位移从静态姿态重新开始。 */
  play(state: PetState, artName: string): void {
    this.state = state;
    this.frames = [];
    this.index = 0;
    this.stopTimer();
    const token = ++this.token;
    this.animate();
    void loadStateFrames(artName, state).then((frames) => {
      if (token !== this.token || frames.length === 0 || Quality.low) {
        return;
      }
      this.frames = frames;
      this.showCurrent();
      this.startTimer();
    });
  }

  /** 页面销毁或切档时收尾：停掉定时器与位移，避免残留 tween 作用在已销毁节点上。 */
  stop(): void {
    this.token += 1;
    this.frames = [];
    this.stopTimer();
    const content = this.host.contentNode;
    if (content) {
      Tween.stopAllByTarget(content);
    }
  }

  /** 静态姿态先落地：sick 塌缩、recover 略微站正，其余原尺寸。 */
  private animate(): void {
    const content = this.host.contentNode;
    if (!content) {
      return;
    }
    Tween.stopAllByTarget(content);
    content.setScale(Vec3.ONE);
    if (this.state === 'sick') {
      content.setScale(new Vec3(0.94, 0.94, 1));
      return;
    }
    if (this.state === 'recover') {
      content.setScale(new Vec3(0.97, 0.97, 1));
    }
    if (Quality.low) {
      return;
    }
    this.loop(content);
  }

  private loop(content: Node): void {
    if (this.state === 'recover') {
      tween(content)
        .to(0.5, { angle: -4 })
        .to(0.5, { angle: 4 })
        .to(0.5, { angle: 0 })
        .union()
        .repeatForever()
        .start();
      return;
    }
    if (this.state === 'happy') {
      tween(content)
        .by(0.24, { position: new Vec3(0, JUMP_HEIGHT, 0) })
        .by(0.24, { position: new Vec3(0, -JUMP_HEIGHT, 0) })
        .union()
        .repeatForever()
        .start();
      return;
    }
    const amplitude = this.state === 'sleep' ? 1.015 : 1.03;
    const seconds = this.state === 'sleep' ? 2.2 : 1.1;
    tween(content)
      .to(seconds, { scale: new Vec3(amplitude, amplitude, 1) })
      .to(seconds, { scale: Vec3.ONE })
      .union()
      .repeatForever()
      .start();
  }

  private startTimer(): void {
    this.stopTimer();
    this.timer = setTimeout(() => this.tick(), FRAME_INTERVAL_MS);
  }

  private tick(): void {
    if (this.frames.length === 0 || !this.host.contentNode) {
      this.stopTimer();
      return;
    }
    this.index = (this.index + 1) % this.frames.length;
    this.showCurrent();
    this.startTimer();
  }

  private showCurrent(): void {
    const frame = this.frames[this.index];
    if (frame) {
      this.host.showFrame(frame);
    }
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
