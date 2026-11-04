// STATUS: implemented, W4 诊断统一评分入口（听诊/拍片/化验共用，04 §7）
import type { AuscultationResult } from './AuscultationScore';
import { judgeStars } from './AuscultationScore';

export type DiagnosisOutcome = AuscultationResult;

export function emptyOutcome(completed: boolean, totalMs = 0): DiagnosisOutcome {
  return { completed, stars: 0, found: 0, total: 0, mistakes: 0, timeUsedMs: 0, totalMs };
}

/**
 * 最多 2 个诊断合并：错误数与用时累加，星级取「用时公式」与「各小游戏自己的星级」的较小值。
 * 听诊的连击星级必须在这里生效，否则会被合并时重算的 judgeStars 覆盖；跳过道具（totalMs=0）不参与封顶。
 */
export function combineDiagnosis(outcomes: readonly DiagnosisOutcome[]): DiagnosisOutcome {
  if (outcomes.length === 0) {
    return emptyOutcome(false);
  }
  const mistakes = outcomes.reduce((sum, item) => sum + item.mistakes, 0);
  const timeUsedMs = outcomes.reduce((sum, item) => sum + item.timeUsedMs, 0);
  const totalMs = outcomes.reduce((sum, item) => sum + item.totalMs, 0);
  const completed = outcomes.every((item) => item.completed);
  const cap = outcomes.reduce(
    (min, item) => (item.totalMs > 0 ? Math.min(min, item.stars) : min),
    3,
  );
  return {
    completed,
    stars: completed ? Math.min(judgeStars(mistakes, timeUsedMs, totalMs), cap) : 0,
    found: outcomes.reduce((sum, item) => sum + item.found, 0),
    total: outcomes.reduce((sum, item) => sum + item.total, 0),
    mistakes,
    timeUsedMs,
    totalMs,
  };
}
