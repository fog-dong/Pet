// STATUS: implemented, W20-2 小屋数据层（读领养宠物 + 三项属性互动规则；全部只落本地存档）
import { clampStat, HabitatPet, seedHabitat, STAT_MAX } from '../cache/HabitatCodec';
import { Save } from '../cache/Save';
import type { AudioCue } from '../config/AudioConfig';
import { CharacterConfig } from '../config/CharacterConfig';

/**
 * 读小屋成员。habitat 字段是 W20 才加的，老存档里只有 petsAdopted；
 * 这里按 petsAdopted 补齐缺失条目并立刻写回，所以不会出现「图鉴已领养、小屋里缺席」。
 */
export function habitatList(): HabitatPet[] {
  const missing = missingEntries();
  if (missing.length > 0) {
    Save.mutate((data) => {
      missing.forEach((petId) => data.habitat.push(seedHabitat(petId, CharacterConfig.petById(petId))));
    });
  }
  return Save.snapshot().habitat;
}

export type HabitatAction = 'feed' | 'bath' | 'pet';
export type HabitatStatKey = 'hunger' | 'cleanliness' | 'mood';

export interface HabitatRule {
  stat: HabitatStatKey;
  delta: number;
  costCoins: number;
  costHearts: number;
  cue: AudioCue;
  /** 冷却毫秒：只有免费动作需要，否则能连点把属性刷满。 */
  cooldownMs: number;
  label: string;
  costText: string;
  fullText: string;
  floatText: string;
}

export const HABITAT_RULES: Record<HabitatAction, HabitatRule> = {
  feed: {
    stat: 'hunger', delta: 30, costCoins: 10, costHearts: 0, cue: 'feed', cooldownMs: 0,
    label: '喂食', costText: '10 金币', fullText: '已经吃饱啦', floatText: '+30 饱食度',
  },
  bath: {
    stat: 'cleanliness', delta: 40, costCoins: 0, costHearts: 5, cue: 'bath', cooldownMs: 0,
    label: '洗澡', costText: '5 爱心', fullText: '已经很干净啦', floatText: '+40 清洁度',
  },
  pet: {
    stat: 'mood', delta: 15, costCoins: 0, costHearts: 0, cue: 'pet', cooldownMs: 60 * 1000,
    label: '抚摸', costText: '免费', fullText: '心情已经满格啦', floatText: '+15 心情',
  },
};

export const HABITAT_ACTIONS: readonly HabitatAction[] = ['feed', 'bath', 'pet'];

export type HabitatOutcome =
  | { kind: 'done'; entry: HabitatPet; rule: HabitatRule }
  | { kind: 'blocked'; text: string };

/** 一次互动：先验状态与消耗，通过后改属性并立刻落盘（偏差 D19：只写本地）。 */
export function runHabitatAction(petId: string, action: HabitatAction): HabitatOutcome {
  const rule = HABITAT_RULES[action];
  const entry = habitatList().find((item) => item.petId === petId);
  if (!entry) {
    return { kind: 'blocked', text: '这只宠物还没领养' };
  }
  if (entry[rule.stat] >= STAT_MAX) {
    return { kind: 'blocked', text: rule.fullText };
  }
  if (rule.cooldownMs > 0) {
    const remain = rule.cooldownMs - (Date.now() - entry.lastPettedAt);
    if (remain > 0) {
      return { kind: 'blocked', text: `刚摸过啦，${Math.ceil(remain / 1000)} 秒后再来` };
    }
  }
  if (rule.costCoins > 0 && !Save.spendCoins(rule.costCoins)) {
    return { kind: 'blocked', text: '金币不足' };
  }
  if (rule.costHearts > 0 && !Save.spendHearts(rule.costHearts)) {
    return { kind: 'blocked', text: '爱心不足' };
  }
  Save.mutate((data) => {
    const target = data.habitat.find((item) => item.petId === petId);
    if (!target) {
      return;
    }
    target[rule.stat] = clampStat(target[rule.stat] + rule.delta);
    if (rule.cooldownMs > 0) {
      target.lastPettedAt = Date.now();
    }
  });
  return { kind: 'done', entry, rule };
}

function missingEntries(): string[] {
  const save = Save.snapshot();
  return save.petsAdopted.filter((petId) => !save.habitat.some((entry) => entry.petId === petId));
}
