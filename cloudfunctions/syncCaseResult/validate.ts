// STATUS: implemented, W12-3 入参校验（冻结 §2.4 的 DiagnosisInput / TreatmentInput）
import { isInt, isPlain } from './guard';
import type { DiagnosisInput, TreatmentInput } from './types';

const DIAGNOSIS_TYPES: readonly string[] = ['auscultation', 'xray', 'lab'];
const TREATMENT_RESULTS: readonly string[] = ['success', 'partial', 'fail'];
const MAX_MEDICINES = 10;

export function readDiagnosis(raw: unknown): DiagnosisInput | null {
  if (!isPlain(raw)) {
    return null;
  }
  const { type, stars, mistakes, durationMs } = raw;
  if (typeof type !== 'string' || !DIAGNOSIS_TYPES.includes(type)) {
    return null;
  }
  if (!isInt(stars, 0, 3) || !isInt(mistakes, 0, 99) || !isInt(durationMs, 0, 24 * 3600 * 1000)) {
    return null;
  }
  return { type: type as DiagnosisInput['type'], stars, mistakes, durationMs };
}

export function readTreatment(raw: unknown): TreatmentInput | null {
  if (!isPlain(raw)) {
    return null;
  }
  const { result, medicineUsed, bedUsed, healing } = raw;
  if (typeof result !== 'string' || !TREATMENT_RESULTS.includes(result)) {
    return null;
  }
  if (!Array.isArray(medicineUsed) || medicineUsed.length > MAX_MEDICINES) {
    return null;
  }
  if (!medicineUsed.every((item): item is string => typeof item === 'string' && item.length > 0)) {
    return null;
  }
  if (typeof bedUsed !== 'boolean' || !isInt(healing, 0, 3)) {
    return null;
  }
  return { result: result as TreatmentInput['result'], medicineUsed: [...medicineUsed], bedUsed, healing };
}
