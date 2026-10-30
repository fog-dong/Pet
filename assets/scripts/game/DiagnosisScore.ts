// STATUS: implemented, W4 诊断统一评分入口（听诊/拍片/化验共用，04 §7）
import type { AuscultationResult } from './AuscultationScore';
import { judgeStars } from './AuscultationScore';

export type DiagnosisOutcome = AuscultationResult;

export function emptyOutcome(completed: boolean, totalMs = 0): DiagnosisOutcome {
  return { completed, stars: 0, found: 0, total: 0, mistakes: 0, timeUsedMs: 0, totalMs };
}

/** 最多 2 个诊断合并：错误数与用时累加，星级仍由同一 judgeStars 决定。 */
export function combineDiagnosis(outcomes: readonly DiagnosisOutcome[]): DiagnosisOutcome {
  if (outcomes.length === 0) {
    return emptyOutcome(false);
  }
  const mistakes = outcomes.reduce((sum, item) => sum + item.mistakes, 0);
  const timeUsedMs = outcomes.reduce((sum, item) => sum + item.timeUsedMs, 0);
  const totalMs = outcomes.reduce((sum, item) => sum + item.totalMs, 0);
  const completed = outcomes.every((item) => item.completed);
  return {
    completed,
    stars: completed ? judgeStars(mistakes, timeUsedMs, totalMs) : 0,
    found: outcomes.reduce((sum, item) => sum + item.found, 0),
    total: outcomes.reduce((sum, item) => sum + item.total, 0),
    mistakes,
    timeUsedMs,
    totalMs,
  };
}
