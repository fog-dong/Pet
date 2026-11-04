// STATUS: implemented, W25 P2-A2 危重抢救倒计时（只认 Date.now，切后台可暂停）
export type CrisisStatus = 'idle' | 'running' | 'paused' | 'expired';

export interface CrisisTimerView {
  status: CrisisStatus;
  seconds: number;
  ratio: number;
}

interface CrisisTimerState {
  counting: boolean;
  totalMs: number;
  startedAt: number;
  /** 累计暂停时长，从经过时间里扣掉。 */
  pausedMs: number;
  /** >0 表示正处于切后台暂停中，记录此刻的时间戳。 */
  hiddenAt: number;
}

const state: CrisisTimerState = { counting: false, totalMs: 0, startedAt: 0, pausedMs: 0, hiddenAt: 0 };

/** 只走 Date.now：验收脚本靠改写它来快进时钟，不给生产留调试钩子。 */
function leftMs(): number {
  if (state.startedAt <= 0) {
    return state.totalMs;
  }
  const end = state.hiddenAt > 0 ? state.hiddenAt : Date.now();
  const spent = Math.max(0, end - state.startedAt - state.pausedMs);
  return Math.max(0, state.totalMs - spent);
}

/** 纯时长状态；危急度档位与药品账目在 game/CaseCrisis，终局结算在 game/CrisisTransfer。 */
export const CrisisTimer = {
  get active(): boolean {
    return state.counting;
  },

  get totalMs(): number {
    return state.totalMs;
  },

  reset(): void {
    state.counting = false;
    state.totalMs = 0;
    state.startedAt = 0;
    state.pausedMs = 0;
    state.hiddenAt = 0;
  },

  start(totalMs: number): void {
    state.counting = true;
    state.totalMs = totalMs;
    state.startedAt = Date.now();
    state.pausedMs = 0;
    state.hiddenAt = 0;
  },

  /** 治疗成功：时钟停，档位与消耗留档，不再倒数。 */
  stop(): void {
    state.counting = false;
    state.hiddenAt = 0;
  },

  pause(): void {
    if (!state.counting || state.hiddenAt > 0) {
      return;
    }
    state.hiddenAt = Date.now();
  },

  resume(): void {
    if (state.hiddenAt <= 0) {
      return;
    }
    state.pausedMs += Date.now() - state.hiddenAt;
    state.hiddenAt = 0;
  },

  remainingMs(): number {
    return leftMs();
  },

  view(): CrisisTimerView {
    if (!state.counting) {
      return { status: 'idle', seconds: 0, ratio: 0 };
    }
    const left = leftMs();
    if (left <= 0) {
      return { status: 'expired', seconds: 0, ratio: 0 };
    }
    return {
      status: state.hiddenAt > 0 ? 'paused' : 'running',
      seconds: Math.ceil(left / 1000),
      ratio: state.totalMs > 0 ? left / state.totalMs : 0,
    };
  },
};
