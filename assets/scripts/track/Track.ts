// STATUS: scaffold, API frozen by architect on 2026-10-29
// API: Track.track, see docs/plan/08-客户端架构与状态机.md §9

export type TrackValue = string | number | boolean;
export type TrackProps = Record<string, TrackValue>;

export interface TrackEvent {
  event: string;
  props: TrackProps;
  at: number;
}

export class TrackClient {
  private readonly queue: TrackEvent[] = [];
  private readonly maxQueue = 100;

  track(event: string, props: TrackProps = {}): void {
    if (!event) {
      return;
    }
    this.queue.push({ event, props, at: Date.now() });
    if (this.queue.length > this.maxQueue) {
      this.queue.shift();
    }
  }

  /**
   * W1 只保留内存队列；W2 通过 Net 批量上报，失败按退避重试。
   * 采集范围不含 openid 以外的个人信息。
   */
  flush(): Promise<void> {
    return Promise.resolve();
  }

  size(): number {
    return this.queue.length;
  }
}

export const Track = new TrackClient();
