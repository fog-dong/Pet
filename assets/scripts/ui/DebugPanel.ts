// STATUS: implemented, W6 开发期性能面板（仅 DEBUG 构建挂载，release 不注册）
import { _decorator, Component, Label, profiler } from 'cc';
import { Quality } from '../config/Quality';
import { readHeapMb } from '../net/Perf';
import { addLabel, PALETTE } from './SceneUI';

const { ccclass } = _decorator;
const SAMPLE_SECONDS = 0.5;

@ccclass('DebugPanel')
export class DebugPanel extends Component {
  private label: Label | null = null;
  private frames = 0;
  private elapsed = 0;

  protected onLoad(): void {
    this.label = addLabel(this.node, 'DebugText', '', -344, {
      size: 18,
      color: PALETTE.sub,
      width: 1240,
    });
  }

  protected update(dt: number): void {
    this.frames += 1;
    this.elapsed += dt;
    if (this.elapsed < SAMPLE_SECONDS) {
      return;
    }
    const fps = this.frames / this.elapsed;
    this.frames = 0;
    this.elapsed = 0;
    const stats = profiler.stats;
    const draws = stats ? stats.draws.counter.value : 0;
    const heap = readHeapMb();
    if (this.label) {
      const memory = heap > 0 ? `${heap}MB` : '—';
      this.label.string = `FPS ${fps.toFixed(1)}　DrawCall ${draws}　JS 内存 ${memory}　画质 ${Quality.level}`;
    }
  }
}
