// STATUS: implemented, W8 埋点批量上报（200 条上限丢最旧 + 定时/阈值/回厅/切后台触发，失败整批回队首）
// API: Track.track / Track.flush, see docs/plan/08-客户端架构与状态机.md §9
import { Game, game } from 'cc';
import { Net } from '../net/Net';

export type TrackValue = string | number | boolean;
export type TrackProps = Record<string, TrackValue>;

export interface TrackEvent {
  event: string;
  props: TrackProps;
  at: number;
}

/** 队列上限 200，满了丢最旧；达到 50 条提前上报，单次最多发 50 条。 */const MAX_QUEUE = 200;
const FLUSH_THRESHOLD = 50;
const MAX_BATCH = 50;
const FLUSH_INTERVAL_MS = 20000;
const FLUSH_MIN_INTERVAL_MS = 15000;
const MAX_PROPS = 8;

function clipValue(value: TrackValue): TrackValue {
  return typeof value === 'string' && value.length > 64 ? value.slice(0, 64) : value;
}

function clipProps(props: TrackProps): TrackProps {
  const keys = Object.keys(props).slice(0, MAX_PROPS);
  const clean: TrackProps = {};
  for (const key of keys) {
    clean[key] = clipValue(props[key]);
  }
  return clean;
}

export class TrackClient {
  private queue: TrackEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private uploading = false;
  private lastFlushAt = 0;
  private sequence = 0;

  /** 只装一次：定时上报 + 切后台立即上报。 */
  start(): void {
    if (this.timer !== null) {
      return;
    }
    this.timer = setInterval(() => {
      void this.flush();
    }, FLUSH_INTERVAL_MS);
    game.on(Game.EVENT_HIDE, this.onHide, this);
  }

  track(event: string, props: TrackProps = {}): void {
    if (!event) {
      return;
    }
    this.queue.push({ event, props: clipProps(props), at: Date.now() });
    while (this.queue.length > MAX_QUEUE) {
      this.queue.shift();
    }
    if (this.queue.length >= FLUSH_THRESHOLD) {
      void this.flush();
    }
  }

  /**
   * 取一批先出队再上报，避免同一事件被重复发送；网络或业务失败整批放回队首。
   * force 用于切后台，其余触发受最小间隔约束。
   */
  async flush(force = false): Promise<void> {
    if (this.uploading || this.queue.length === 0 || !Net.ready) {
      return;
    }
    const now = Date.now();
    if (!force && now - this.lastFlushAt < FLUSH_MIN_INTERVAL_MS) {
      return;
    }
    const batch = this.queue.splice(0, MAX_BATCH);
    this.uploading = true;
    this.lastFlushAt = now;
    this.sequence += 1;
    const batchId = `${now.toString(36)}-${this.sequence.toString(36)}`;

    const response = await Net.call<Record<string, unknown>>(
      'trackEvent',
      { batchId, events: batch },
      { retry: 0, timeoutMs: 6000 },
    );
    this.uploading = false;
    if (response.code < 0) {
      // 网络/超时才回队首重试；服务端参数或频控拒绝直接丢弃这批，避免死循环重传。
      this.queue.unshift(...batch);
      while (this.queue.length > MAX_QUEUE) {
        this.queue.pop();
      }
    }
  }

  size(): number {
    return this.queue.length;
  }

  private onHide(): void {
    void this.flush(true);
  }
}

export const Track = new TrackClient();
