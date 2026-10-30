// STATUS: implemented, W3 本地存档编解码（纯函数，无副作用）
export interface SaveData {
  coins: number;
  hearts: number;
  petsSeen: string[];
  petsAdopted: string[];
  bestStars: Record<string, number>;
  casesDone: number;
  items: Record<string, number>;
}

/** 新档默认道具：听诊器电池 1 个，保证失败后有一条免费跳过路径。 */
export const DEFAULT_ITEMS: Record<string, number> = { battery: 1 };

export function emptySave(): SaveData {
  return {
    coins: 0,
    hearts: 0,
    petsSeen: [],
    petsAdopted: [],
    bestStars: {},
    casesDone: 0,
    items: { ...DEFAULT_ITEMS },
  };
}

function toNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function toNumberMap(value: unknown): Record<string, number> {
  const result: Record<string, number> = {};
  if (!value || typeof value !== 'object') {
    return result;
  }
  const source = value as Record<string, unknown>;
  for (const key in source) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      continue;
    }
    const raw = source[key];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      result[key] = raw;
    }
  }
  return result;
}

export function decodeSave(raw: string | null): SaveData {
  if (!raw) {
    return emptySave();
  }
  try {
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      coins: toNumber(parsed.coins, 0),
      hearts: toNumber(parsed.hearts, 0),
      petsSeen: toStringArray(parsed.petsSeen),
      petsAdopted: toStringArray(parsed.petsAdopted),
      bestStars: toNumberMap(parsed.bestStars),
      casesDone: toNumber(parsed.casesDone, 0),
      items: parsed.items ? toNumberMap(parsed.items) : { ...DEFAULT_ITEMS },
    };
  } catch {
    return emptySave();
  }
}
