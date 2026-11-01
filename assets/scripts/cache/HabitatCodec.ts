// STATUS: implemented, W20-2 小屋条目编解码（纯函数；偏差 D19：三项属性暂时只落本地存档）
import type { PetConfigItem } from '../config/CharacterConfig';

export interface HabitatPet {
  petId: string;
  /** 饱食度 0-100。 */
  hunger: number;
  /** 清洁度 0-100。 */
  cleanliness: number;
  /** 心情 0-100。 */
  mood: number;
  /** 上次抚摸的时间戳（ms），用于冷却判定。 */
  lastPettedAt: number;
}

/** pets.json 缺字段（老配置或漏配）时的兜底初始值。 */
export const HABITAT_DEFAULT = { hunger: 70, cleanliness: 75, mood: 60 };

export const STAT_MAX = 100;

export function clampStat(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(STAT_MAX, Math.round(value)));
}

function toStat(value: unknown, fallback: number): number {
  return typeof value === 'number' ? clampStat(value) : fallback;
}

/** 领养入屋：初始值优先取 pets.json 的品种默认，没有就用全局兜底。 */
export function seedHabitat(petId: string, look?: PetConfigItem | null): HabitatPet {
  return {
    petId,
    hunger: toStat(look?.hunger, HABITAT_DEFAULT.hunger),
    cleanliness: toStat(look?.cleanliness, HABITAT_DEFAULT.cleanliness),
    mood: toStat(look?.mood, HABITAT_DEFAULT.mood),
    lastPettedAt: 0,
  };
}

/** 旧档没有 habitat 字段时返回空数组，由数据层按 petsAdopted 补种。 */
export function decodeHabitat(value: unknown): HabitatPet[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const result: HabitatPet[] = [];
  value.forEach((raw) => {
    if (!raw || typeof raw !== 'object') {
      return;
    }
    const item = raw as Partial<HabitatPet>;
    if (typeof item.petId !== 'string' || !item.petId) {
      return;
    }
    if (result.some((entry) => entry.petId === item.petId)) {
      return;
    }
    result.push({
      petId: item.petId,
      hunger: toStat(item.hunger, HABITAT_DEFAULT.hunger),
      cleanliness: toStat(item.cleanliness, HABITAT_DEFAULT.cleanliness),
      mood: toStat(item.mood, HABITAT_DEFAULT.mood),
      lastPettedAt: typeof item.lastPettedAt === 'number' ? item.lastPettedAt : 0,
    });
  });
  return result;
}
