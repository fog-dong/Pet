// STATUS: implemented, W5 单局阶段埋点（自 CaseSession 抽出以控制文件行数）
import { Track } from '../track/Track';
import type { DiagnosisResult, RecoveryResult, TreatmentResult } from './CaseSettle';

export function trackDiagnosis(caseId: string, result: DiagnosisResult): void {
  Track.track('diagnosis_result', {
    caseId,
    stars: result.stars,
    mistakes: result.mistakes,
    timeUsed: result.durationMs,
    duration: result.durationMs,
    retryCount: result.retryCount,
  });
}

export function trackTreatment(caseId: string, result: TreatmentResult): void {
  Track.track('treatment_result', {
    caseId,
    success: result.success,
    score: result.score,
    bed: result.bed,
    medicine: result.medicines.join('+'),
    medicineCount: result.medicines.length,
  });
}

export function trackRecovery(caseId: string, result: RecoveryResult): void {
  Track.track('recovery_result', {
    caseId,
    stars: result.stars,
    elapsed: result.elapsedMs,
    total: result.totalMs,
  });
}
