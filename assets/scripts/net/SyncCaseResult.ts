// STATUS: implemented, W13-2 单局结果上报（2002 配置未发布改为可恢复：留队重试，不丢金币）
import { Net, NetResponse } from './Net';
import { enqueueCase, readCaseQueue, removeCase } from '../cache/PendingSync';
import { classifySyncCode, drainQueue } from './SyncPolicy';
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
  const verdict = classifySyncCode(response.code);
  if (verdict === 'ok') {
    removeCase(input.caseSessionId);
    return response;
  }
  if (verdict === 'drop') {
    removeCase(input.caseSessionId);
    Track.track('case_sync_dropped', { code: response.code });
    return response;
  }
  // defer（2002 配置未发布）/ retry（网络或 1006）：留在本地队列，下次启动、进厅或下局结算后重试。
  enqueueCase(input);
  Track.track('case_sync_queued', { code: response.code, recoverable: verdict === 'defer' });
  return response;
}

/** 启动 / 进厅 / 结算成功后补发；网络类失败即停，保留队列等下次再试。 */
export async function flushPending(): Promise<number> {
  if (!Net.ready) {
    return 0;
  }
  const queue = readCaseQueue();
  if (queue.length === 0) {
    return 0;
  }
  const result = await drainQueue(queue, async (item) => (await syncCaseResult(item)).code);
  if (result.sent > 0) {
    Track.track('pending_case_flushed', { count: result.sent });
  }
  if (result.deferred > 0) {
    Track.track('pending_case_deferred', { count: result.deferred });
  }
  return result.sent;
}
