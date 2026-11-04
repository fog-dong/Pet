// STATUS: implemented, W25 P2-A2 本局危重瞬时态（危急度升档 + 治疗重试用尽 + 转院账目）
import { PenaltyConfig } from '../config/PenaltyConfig';
import { gameFSM } from '../core/GameFSM';
import { Track } from '../track/Track';
import { CrisisTimer } from './CrisisTimer';
import type { CrisisTimerView } from './CrisisTimer';

export type CrisisTrigger = 'diagnosis' | 'retry';

/** 时钟视图 + 触发源；红条与失败提示都只读这一份。 */
export interface CrisisView extends CrisisTimerView {
  trigger: CrisisTrigger | '';
}

interface CrisisState {
  /** 已上调的档位数；effectiveSeverity 按它在 severityOrder 里往后挪。 */
  step: number;
  retries: number;
  consumed: string[];
  trigger: CrisisTrigger | '';
  transferred: boolean;
  refunded: string[];
  heartsCost: number;
  reputationCost: number;
}

function idleState(): CrisisState {
  return {
    step: 0,
    retries: 0,
    consumed: [],
    trigger: '',
    transferred: false,
    refunded: [],
    heartsCost: 0,
    reputationCost: 0,
  };
}

const state: CrisisState = idleState();

/** 单局危重状态；开局与放弃由 CaseSession 统一 reset，不入存档。 */
export const CaseCrisis = {
  get transferred(): boolean {
    return state.transferred;
  },

  /** 本局真正扣掉的药；转院时按 refundRatio 退回。 */
  get consumedMedicines(): readonly string[] {
    return state.consumed;
  },

  get refundedMedicines(): readonly string[] {
    return state.refunded;
  },

  /** 转院的两笔硬损失，结算页只展示非零项（口碑 0 分的人不会被扣成负数）。 */
  get transferCost(): { hearts: number; reputation: number } {
    return { hearts: state.heartsCost, reputation: state.reputationCost };
  },

  /** 倒计时总长，未启动为 0；验收用它确认配置真的读到了而不是走兜底。 */
  get countdownMs(): number {
    return CrisisTimer.totalMs;
  },

  reset(): void {
    Object.assign(state, idleState());
    CrisisTimer.reset();
  },

  /** 失误升级：危急度上调一档，封顶在档位表最后一档。 */
  escalateSeverity(): void {
    state.step = Math.min(state.step + 1, PenaltyConfig.severities.length - 1);
  },

  /** 所有门槛判定都走这里，保证「恶化后的病例」按升档后的危急度算。 */
  effectiveSeverity(base: string): string {
    const order = PenaltyConfig.severities;
    const found = order.indexOf(base);
    const at = Math.min((found < 0 ? 0 : found) + state.step, order.length - 1);
    return order[at];
  },

  /** 倒计时只在配置好的状态里跑（默认诊断 + 治疗，康复不再干等）。 */
  inScope(): boolean {
    return PenaltyConfig.crisis.scope.includes(gameFSM.state);
  },

  begin(trigger: CrisisTrigger, caseId = ''): void {
    if (CrisisTimer.active || !this.inScope()) {
      return;
    }
    const seconds = PenaltyConfig.crisis.countdownSeconds;
    state.trigger = trigger;
    CrisisTimer.start(seconds * 1000);
    Track.track('crisis_begin', { caseId, trigger, step: state.step, seconds });
  },

  /** 第 retryLimit 次治疗仍不达标即转入危重；返回 true 表示重试用尽。 */
  addTreatmentRetry(caseId: string): boolean {
    state.retries += 1;
    Track.track('treatment_retry', { caseId, retries: state.retries });
    const exhausted = state.retries >= PenaltyConfig.treatment.retryLimit;
    if (exhausted) {
      this.begin('retry', caseId);
    }
    return exhausted;
  },

  consume(names: readonly string[]): void {
    for (const name of names) {
      state.consumed.push(name);
    }
  },

  /** 治疗成功解除危机：时钟停，档位与消耗留在本局，结算页还要读。 */
  clear(): void {
    state.trigger = '';
    CrisisTimer.stop();
  },

  pause(): void {
    CrisisTimer.pause();
  },

  resume(): void {
    CrisisTimer.resume();
  },

  remainingMs(): number {
    return CrisisTimer.remainingMs();
  },

  view(): CrisisView {
    return { ...CrisisTimer.view(), trigger: state.trigger };
  },

  /** 转院落地：记完账彻底结束本局危机，时钟清零。 */
  noteTransfer(refunded: readonly string[], heartsCost: number, reputationCost: number): void {
    state.transferred = true;
    state.trigger = '';
    state.refunded = [...refunded];
    state.heartsCost = heartsCost;
    state.reputationCost = reputationCost;
    CrisisTimer.reset();
  },
};
