// STATUS: implemented, W20-2 小屋数据层 + W22-4 生命周期衰减接入 + W23-1 数值对齐与每日次数上限
// 互动规则表见 game/HabitatRules.ts，衰减倍率与老年小毛病见 game/HabitatDecay.ts；本文件只做编排与落盘（偏差 D19：全部只写本地存档）。
import { clampStat, HabitatPet, seedHabitat, STAT_MAX } from '../cache/HabitatCodec';
import { dayKeyToTime, todayKey } from '../cache/DayKey';
import { Save } from '../cache/Save';
import { PetQuota } from '../cache/PetQuota';
import { isRehomed } from '../cache/RehomeCodec';
import { CharacterConfig } from '../config/CharacterConfig';
import { getLifeStage, LifeStage } from './AgeSystem';
import { ailmentCost, applyDecay, elapsedDecayHours, floatTextOf, statDelta } from './HabitatDecay';
import { HabitatAction, HabitatRule, HABITAT_RULES } from './HabitatRules';

export type HabitatOutcome =
  | { kind: 'done'; entry: HabitatPet; rule: HabitatRule; delta: number; floatText: string; soothed: boolean }
  | { kind: 'blocked'; text: string };

/**
 * 读小屋成员。habitat 字段是 W20 才加的，老存档里只有 petsAdopted；
 * 这里按 petsAdopted 补齐缺失条目并立刻写回，所以不会出现「图鉴已领养、小屋里缺席」。
 * 读之前先补算衰减——属性只在玩家进屋时被结算，后台不跑定时器。
 */
export function habitatList(): HabitatPet[] {
  const missing = missingEntries();
  if (missing.length > 0) {
    Save.mutate((data) => {
      missing.forEach((petId) => data.habitat.push(seedHabitat(petId, CharacterConfig.petById(petId))));
    });
  }
  backfillLifecycle();
  settleDecay();
  // M1 拆雷：送走的宠物即使旧档残留 habitat 条目，也绝不能再回屋。
  const save = Save.snapshot();
  return save.habitat.filter((entry) => !isRehomed(save.rehome, entry.petId));
}

/**
 * 老存档缺 `birthTimestamp` / `lastDecayAt`：生日按 `adoptedAt` 回填，回填不到才当今天出生；
 * 衰减水位一律置为当前时间——不按领养日追溯扣属性，否则老玩家一进屋就看到数值掉光。
 */
function backfillLifecycle(): void {
  const stale = Save.snapshot().habitat.filter((entry) => entry.birthTimestamp <= 0 || entry.lastDecayAt <= 0);
  if (stale.length === 0) {
    return;
  }
  const now = Date.now();
  Save.mutate((data) => {
    stale.forEach((entry) => {
      const target = data.habitat.find((item) => item.petId === entry.petId);
      if (!target) {
        return;
      }
      if (target.birthTimestamp <= 0) {
        const adopted = dayKeyToTime(Save.adoptionDate(entry.petId));
        target.birthTimestamp = adopted > 0 && adopted <= now ? adopted : now;
      }
      if (target.lastDecayAt <= 0) {
        target.lastDecayAt = now;
      }
    });
  });
}

/** 按 `lastDecayAt` 水位一次性补算衰减；水位只向前推进，重复调用是幂等的。 */
function settleDecay(): void {
  const now = Date.now();
  Save.mutate((data) => {
    data.habitat.forEach((entry) => {
      const hours = elapsedDecayHours(entry.lastDecayAt, now);
      if (hours > 0) {
        applyDecay(entry, stageOf(entry, now), hours, clampStat);
      }
    });
  });
}

/** 只读余额与今日次数、不扣费：互动菜单据此提前置灰，玩家不必点了才知道买不起（方案 §2.4）。 */
export function affordShortfall(rule: HabitatRule): string | null {
  return PetQuota.shortfall(rule.label, rule.dailyLimit) ?? shortfallFor(rule.costCoins, rule.costHearts);
}

/** 当前生命周期阶段：阈值只从 pets.json 的品种配置读，缺配由 AgeSystem 兜底，本文件无 petId 分支。 */
export function stageOf(entry: HabitatPet, now: number = Date.now()): LifeStage {
  return getLifeStage(entry.birthTimestamp, CharacterConfig.petById(entry.petId), now);
}

/** 一次互动：先补算衰减，再验状态、今日次数与消耗，通过后改属性并立刻落盘。 */
export function runHabitatAction(petId: string, action: HabitatAction): HabitatOutcome {
  const rule = HABITAT_RULES[action];
  const entry = habitatList().find((item) => item.petId === petId);
  if (!entry) {
    return { kind: 'blocked', text: '这只宠物还没领养' };
  }
  if (entry[rule.stat] >= STAT_MAX) {
    return { kind: 'blocked', text: rule.fullText };
  }
  const stage = stageOf(entry);
  const dayKey = todayKey();
  const limitText = PetQuota.shortfall(rule.label, rule.dailyLimit, dayKey);
  if (limitText) {
    return { kind: 'blocked', text: limitText };
  }
  const soothCost = ailmentCost(entry, stage, dayKey);
  const hearts = rule.costHearts + soothCost;
  const shortfall = shortfallFor(rule.costCoins, hearts);
  if (shortfall) {
    return { kind: 'blocked', text: shortfall };
  }
  if (rule.costCoins > 0 && !Save.spendCoins(rule.costCoins)) {
    return { kind: 'blocked', text: shortfallText('金币', rule.costCoins) };
  }
  if (hearts > 0 && !Save.spendHearts(hearts)) {
    return { kind: 'blocked', text: shortfallText('爱心', hearts) };
  }
  const delta = statDelta(rule, stage);
  Save.mutate((data) => {
    const target = data.habitat.find((item) => item.petId === petId);
    if (!target) {
      return;
    }
    target[rule.stat] = clampStat(target[rule.stat] + delta);
    if (soothCost > 0) {
      target.soothedDay = dayKey;
    }
  });
  PetQuota.consume(rule.dailyLimit, dayKey);
  return { kind: 'done', entry, rule, delta, floatText: floatTextOf(rule, delta), soothed: soothCost > 0 };
}

function shortfallFor(coins: number, hearts: number): string | null {
  if (coins > 0 && Save.coins < coins) {
    return shortfallText('金币', coins);
  }
  if (hearts > 0 && Save.hearts < hearts) {
    return shortfallText('爱心', hearts);
  }
  return null;
}

function shortfallText(kind: '金币' | '爱心', need: number): string {
  return `${kind}不足（需 ${need}）`;
}

function missingEntries(): string[] {
  const save = Save.snapshot();
  // 送走的宠物仍在 petsAdopted（图鉴点亮），补条目时必须排除，否则会「诈尸回屋」。
  return save.petsAdopted.filter((petId) => !isRehomed(save.rehome, petId) && !save.habitat.some((entry) => entry.petId === petId));
}
