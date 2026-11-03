// STATUS: implemented, W20-2 小屋条目编解码 + W22-3 生命周期字段（纯函数；偏差 D19：全部只落本地存档）
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
  /**
   * 出生（进屋）时间戳 ms。0 表示老存档缺字段，由 `game/HabitatModel` 按 `adoptedAt` 回填；
   * 回填不到才取当前时间。只用于展示与互动数值，不参与离线收益计价（红线 G4）。
   */
  birthTimestamp: number;
  /** 上次补算衰减的水位时间戳 ms；只向前推进，绝不追溯扣老档属性。 */
  lastDecayAt: number;
  /** 已完成「老年小毛病」安抚的日期键（与 `todayKey()` 同格式）；空串表示今天还没安抚过。 */
  soothedDay: string;
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

/** 领养入屋：初始值优先取 pets.json 的品种默认，没有就用全局兜底；出生与衰减水位都从「现在」起算。 */
export function seedHabitat(petId: string, look?: PetConfigItem | null, now: number = Date.now()): HabitatPet {
  const stamp = Number.isFinite(now) && now > 0 ? Math.floor(now) : Date.now();
  return {
    petId,
    hunger: toStat(look?.hunger, HABITAT_DEFAULT.hunger),
    cleanliness: toStat(look?.cleanliness, HABITAT_DEFAULT.cleanliness),
    mood: toStat(look?.mood, HABITAT_DEFAULT.mood),
    lastPettedAt: 0,
    birthTimestamp: stamp,
    lastDecayAt: stamp,
    soothedDay: '',
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
      lastPettedAt: toTime(item.lastPettedAt),
      // 老档缺这三项：给 0 / 空串，由数据层区分「未知」与「已知水位」，不在解码层猜时间。
      birthTimestamp: toTime(item.birthTimestamp),
      lastDecayAt: toTime(item.lastDecayAt),
      soothedDay: typeof item.soothedDay === 'string' ? item.soothedDay : '',
    });
  });
  return result;
}

function toTime(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}
