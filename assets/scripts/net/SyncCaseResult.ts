// STATUS: implemented, W5 单局结果上报（幂等键 + 失败入队，下次启动补发）
import { Net, NetResponse } from './Net';
import { enqueueCase, readCaseQueue, removeCase } from '../cache/PendingSync';
import { Track } from '../track/Track';

export interface CaseDiagnosisInput {
  type: 'auscultation' | 'xray' | 'lab';
  stars: number;
  mistakes: number;
  durationMs: number;
}

export interface CaseTreatmentInput {
  result: 'success' | 'partial' | 'fail';
  medicineUsed: string[];
  bedUsed: boolean;
  healing: number;
}

export interface CaseSyncInput {
  caseSessionId: string;
  caseId: string;
  diagnosis: CaseDiagnosisInput;
  treatment: CaseTreatmentInput;
  durationMs: number;
}

/** 1002 参数错误、2002 状态非法重发也不会成功，直接丢弃。 */
function isFinal(code: number): boolean {
  return code === 0 || code === 1004 || code === 1002 || code === 2002;
}

export async function syncCaseResult(input: CaseSyncInput): Promise<NetResponse<unknown>> {
  const payload: Record<string, unknown> = {
    caseSessionId: input.caseSessionId,
    caseId: input.caseId,
    diagnosis: {
      type: input.diagnosis.type,
      stars: input.diagnosis.stars,
      mistakes: input.diagnosis.mistakes,
      durationMs: input.diagnosis.durationMs,
    },
    treatment: {
      result: input.treatment.result,
      medicineUsed: input.treatment.medicineUsed,
      bedUsed: input.treatment.bedUsed,
      healing: input.treatment.healing,
    },
    durationMs: input.durationMs,
  };
  const response = await Net.call<unknown>('syncCaseResult', payload, {
    idempotencyKey: input.caseSessionId,
  });
  if (isFinal(response.code)) {
    removeCase(input.caseSessionId);
    if (response.code !== 0 && response.code !== 1004) {
      Track.track('case_sync_dropped', { code: response.code });
    }
    return response;
  }
  enqueueCase(input);
  Track.track('case_sync_queued', { code: response.code });
  return response;
}

/** 启动时补发；网络错误即停，保留队列等下次再试。 */
export async function flushPending(): Promise<number> {
  if (!Net.ready) {
    return 0;
  }
  let sent = 0;
  for (const item of readCaseQueue()) {
    const response = await syncCaseResult(item);
    if (!isFinal(response.code)) {
      break;
    }
    sent += 1;
  }
  if (sent > 0) {
    Track.track('pending_case_flushed', { count: sent });
  }
  return sent;
}
