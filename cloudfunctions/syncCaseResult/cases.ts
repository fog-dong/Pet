// STATUS: implemented, W12-3 病例配置解析（`config` 集合 `configKey='cases'` 的 payload 与本工程 cases.json 同构）
import { isPlain, toCount } from './guard';
import type { CaseConfigItem, RewardConfig } from './types';

function readCorrect(raw: unknown): CaseConfigItem['treatment'] {
  if (!isPlain(raw)) {
    return undefined;
  }
  const correct = isPlain(raw.correct) ? raw.correct : {};
  return {
    correct: {
      medicine: typeof correct.medicine === 'string' ? correct.medicine : undefined,
      bed: typeof correct.bed === 'string' ? correct.bed : undefined,
      time: typeof correct.time === 'string' ? correct.time : undefined,
    },
  };
}

function readBaseRewards(raw: unknown): RewardConfig {
  const source = isPlain(raw) ? raw : {};
  return { coins: toCount(source.coins), hearts: toCount(source.hearts), affection: toCount(source.affection) };
}

/** 配置缺失 / 结构不符时返回 null，由 index.ts 映射成 2002，不做客户端兜底发奖。 */
export function readCaseCatalog(payload: unknown): Map<string, CaseConfigItem> | null {
  if (!isPlain(payload) || !Array.isArray(payload.cases)) {
    return null;
  }
  const catalog = new Map<string, CaseConfigItem>();
  for (const raw of payload.cases) {
    if (!isPlain(raw) || typeof raw.caseId !== 'string' || raw.caseId.length === 0) {
      continue;
    }
    catalog.set(raw.caseId, {
      caseId: raw.caseId,
      petSpecies: typeof raw.petSpecies === 'string' ? raw.petSpecies : undefined,
      petName: typeof raw.petName === 'string' ? raw.petName : undefined,
      severity: typeof raw.severity === 'string' ? raw.severity : undefined,
      treatment: readCorrect(raw.treatment),
      baseRewards: readBaseRewards(raw.baseRewards),
    });
  }
  return catalog.size > 0 ? catalog : null;
}
