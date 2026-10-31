// STATUS: implemented, W5 上报入参组装（病例结果 + 存档快照，字段取自冻结清单 §2.3/§2.4）
import type { CaseConfigItem } from '../config/CaseConfig';
import type { SaveData } from '../cache/SaveCodec';
import type { CaseSyncInput } from '../net/SyncCaseResult';
import type { DiagnosisResult, TreatmentResult } from './CaseSettle';
import { Hospital } from './Hospital';

export interface CaseSnapshot {
  sessionId: string;
  item: CaseConfigItem;
  diagnosis: DiagnosisResult | null;
  treatment: TreatmentResult;
  durationMs: number;
}

function toDiagnosisType(raw: string): 'auscultation' | 'xray' | 'lab' {
  return raw === 'xray' || raw === 'lab' ? raw : 'auscultation';
}

export function buildCaseSync(input: CaseSnapshot): CaseSyncInput {
  const { item, diagnosis, treatment } = input;
  return {
    caseSessionId: input.sessionId,
    caseId: item.caseId,
    diagnosis: {
      type: toDiagnosisType(item.diagnosisTypes?.[0] ?? item.diagnosisType),
      stars: diagnosis ? diagnosis.stars : 0,
      mistakes: diagnosis ? diagnosis.mistakes : 0,
      durationMs: diagnosis ? diagnosis.durationMs : 0,
    },
    treatment: {
      result: treatment.success ? (treatment.score >= 3 ? 'success' : 'partial') : 'fail',
      medicineUsed: treatment.medicines,
      bedUsed: treatment.bed === '住院',
      healing: treatment.score,
    },
    durationMs: input.durationMs,
  };
}

/**
 * 只提交 saveGame 白名单字段（03 validate.ts），其余字段服务端保持原值。
 * W15-1 起不再提交 resources：金币/爱心/道具的云端账本只由 syncCaseResult 写入，
 * 客户端本地数值仅用于离线展示，不能作为服务端发放依据。
 */
export function buildSaveSnapshot(save: Readonly<SaveData>): Record<string, unknown> {
  return {
    level: save.hospitalLevel,
    beds: Hospital.bedsOwned,
    adoptionSlots: Hospital.slots,
  };
}
