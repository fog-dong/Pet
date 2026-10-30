// STATUS: implemented, W4 诊断类型序列（冻结字段 diagnosisTypes 1-2 个，10 §6.1）
import type { CaseConfigItem } from '../config/CaseConfig';

export type DiagnosisKind = 'auscultation' | 'xray' | 'lab';

export const MAX_DIAGNOSES = 2;

/** W3 旧配置里的类型别名；未知类型回退到听诊，保证任何病例都能开局。 */
const ALIASES: Readonly<Record<string, DiagnosisKind>> = {
  auscultation: 'auscultation',
  xray: 'xray',
  lab: 'lab',
  bloodtest: 'lab',
  otoscope: 'lab',
  poison: 'lab',
};

function normalize(value: string): DiagnosisKind {
  return ALIASES[value] ?? 'auscultation';
}

export function diagnosisSequence(item: CaseConfigItem): DiagnosisKind[] {
  const raw = item.diagnosisTypes && item.diagnosisTypes.length > 0
    ? item.diagnosisTypes
    : [item.diagnosisType];
  const kinds: DiagnosisKind[] = [];
  raw.forEach((value) => {
    const kind = normalize(value);
    if (kinds.indexOf(kind) < 0) {
      kinds.push(kind);
    }
  });
  if (kinds.length === 0) {
    kinds.push('auscultation');
  }
  return kinds.slice(0, MAX_DIAGNOSES);
}
