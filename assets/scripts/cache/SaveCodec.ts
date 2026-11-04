// STATUS: implemented, W3 本地存档编解码（纯函数，无副作用）；W20-2 增小屋条目，编解码拆到 HabitatCodec；W23-1 增抚摸每日上限计数
import { decodeHabitat, HabitatPet } from './HabitatCodec';

export interface SaveData {
  coins: number;
  hearts: number;
  petsSeen: string[];
  petsAdopted: string[];
  /** 领养日期 yyyy-M-d，图鉴展示用。 */
  adoptedAt: Record<string, string>;
  /** 已领养宠物的三项属性，只写本地（10 §3.4 偏差 D19）。 */
  habitat: HabitatPet[];
  /**
   * 上次领取离线收益的本地时间戳，只作为 `claimHabitat` 的 `lastClaimTime` 入参；
   * 真正的起算点在服务端 `habitat_state.lastClaimAt`，这里算错也不会多铸币。
   */
  habitatLastClaimAt: number;
  /**
   * 今日已抚摸次数（方案 §2.1：全局计数，不分宠物）与起算日。
   * 与 `adDay` / `adCounts` 同一套口径：`pettedDay` 不等于今天就把 `pettedCount` 视为 0。
   */
  pettedDay: string;
  pettedCount: number;
  /** 小屋装修主题 id（W25 P1-C）。与小屋属性同属本地表现，不上云（偏差 D19）。 */
  habitatTheme: string;
  /** 已购买的主题 id；免费主题不入表，是否拥有由 game/HabitatThemes 判定。 */
  habitatThemes: string[];
  bestStars: Record<string, number>;
  casesDone: number;
  items: Record<string, number>;
  medicines: Record<string, number>;
  hospitalLevel: number;
  bedsOccupied: number;
  affection: Record<string, number>;
  slotBonus: number;
  adDay: string;
  adCounts: Record<string, number>;
}

/** 新档默认道具：听诊器电池 1 个，保证失败后有一条免费跳过路径。 */
export const DEFAULT_ITEMS: Record<string, number> = { battery: 1 };

/** 05 §9 初值：金币 500 / 爱心 20，保证首日能自由试错并完成一次领养。 */
export const INITIAL_COINS = 500;
export const INITIAL_HEARTS = 20;

export function emptySave(): SaveData {
  return {
    coins: INITIAL_COINS,
    hearts: INITIAL_HEARTS,
    petsSeen: [],
    petsAdopted: [],
    adoptedAt: {},
    habitat: [],
    habitatLastClaimAt: 0,
    pettedDay: '',
    pettedCount: 0,
    habitatTheme: 'clinic',
    habitatThemes: [],
    bestStars: {},
    casesDone: 0,
    items: { ...DEFAULT_ITEMS },
    medicines: {},
    hospitalLevel: 1,
    bedsOccupied: 0,
    affection: {},
    slotBonus: 0,
    adDay: '',
    adCounts: {},
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

function toStringMap(value: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (!value || typeof value !== 'object') {
    return result;
  }
  const source = value as Record<string, unknown>;
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key) && typeof source[key] === 'string') {
      result[key] = source[key] as string;
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
      adoptedAt: toStringMap(parsed.adoptedAt),
      habitat: decodeHabitat(parsed.habitat),
      habitatLastClaimAt: Math.max(0, toNumber(parsed.habitatLastClaimAt, 0)),
      pettedDay: typeof parsed.pettedDay === 'string' ? parsed.pettedDay : '',
      pettedCount: Math.max(0, Math.floor(toNumber(parsed.pettedCount, 0))),
      habitatTheme: typeof parsed.habitatTheme === 'string' && parsed.habitatTheme ? parsed.habitatTheme : 'clinic',
      habitatThemes: toStringArray(parsed.habitatThemes),
      bestStars: toNumberMap(parsed.bestStars),
      casesDone: toNumber(parsed.casesDone, 0),
      items: parsed.items ? toNumberMap(parsed.items) : { ...DEFAULT_ITEMS },
      medicines: toNumberMap(parsed.medicines),
      // 等级口径 1-6 与 HOSPITAL_LEVELS 一致；旧存档没有该字段时回到 1 级。
      hospitalLevel: Math.max(1, Math.min(6, toNumber(parsed.hospitalLevel, 1))),
      bedsOccupied: Math.max(0, toNumber(parsed.bedsOccupied, 0)),
      affection: toNumberMap(parsed.affection),
      slotBonus: Math.max(0, toNumber(parsed.slotBonus, 0)),
      adDay: typeof parsed.adDay === 'string' ? parsed.adDay : '',
      adCounts: toNumberMap(parsed.adCounts),
    };
  } catch {
    return emptySave();
  }
}
