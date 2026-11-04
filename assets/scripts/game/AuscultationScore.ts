// STATUS: implemented, W3 听诊结算规则（04-诊断小游戏系统 §7）
export interface AuscultationResult {
  completed: boolean;
  stars: number;
  found: number;
  total: number;
  mistakes: number;
  timeUsedMs: number;
  /** 本小游戏的倒计时总时长，用于多个诊断合并后的星级判定。 */
  totalMs: number;
}

export type AuscultationFinish = (result: AuscultationResult) => void;

/** 全对 + 用时 <70% + 误诊 0 → 3 星；全对误诊 ≤1 → 2 星；其余完成 → 1 星；失败返回 0。 */
export function judgeStars(mistakes: number, timeUsedMs: number, totalMs: number): number {
  if (mistakes === 0 && timeUsedMs < totalMs * 0.7) {
    return 3;
  }
  if (mistakes <= 1) {
    return 2;
  }
  return 1;
}

export function buildResult(
  completed: boolean,
  found: number,
  total: number,
  mistakes: number,
  timeUsedMs: number,
  totalMs: number,
): AuscultationResult {
  return {
    completed,
    stars: completed ? judgeStars(mistakes, timeUsedMs, totalMs) : 0,
    found,
    total,
    mistakes,
    timeUsedMs,
    totalMs,
  };
}

/** P1-B 节奏听诊：全连 3 星，连击过半 2 星，其余完成 1 星。 */
export function judgeRhythmStars(beats: number, maxCombo: number): number {
  if (maxCombo >= beats) {
    return 3;
  }
  return maxCombo >= Math.ceil(beats * 0.6) ? 2 : 1;
}

export function buildRhythmResult(
  completed: boolean,
  hits: number,
  total: number,
  mistakes: number,
  maxCombo: number,
  timeUsedMs: number,
  totalMs: number,
): AuscultationResult {
  return {
    completed,
    stars: completed ? judgeRhythmStars(total, maxCombo) : 0,
    found: hits,
    total,
    mistakes,
    timeUsedMs,
    totalMs,
  };
}
