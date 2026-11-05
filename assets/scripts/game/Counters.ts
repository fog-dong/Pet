// STATUS: implemented, W25 P2-B1 成就计数器（唯一写入口；只落本地存档，成就条件不写 if-petId 分支）
import { Save } from '../cache/Save';

/**
 * key 对齐《深度化玩法系统串联方案》§6.1 的埋点→计数器表。
 * 14 个全部由本文件 `bumpCounter` 生产（P2-B2 6 个 + P2-C 后院 4 个 + P2-D 护理/送养 4 个）；
 * `casesDone` / `reputation` 复用已有存档字段，不占计数器位。
 */
export const COUNTER_KEYS = {
  casePerfect: 'casePerfect',
  caseTransfer: 'caseTransfer',
  wrongMedicine: 'wrongMedicine',
  gachaDraws: 'gachaDraws',
  gachaLegendary: 'gachaLegendary',
  themeBought: 'themeBought',
  gardenPlanted: 'gardenPlanted',
  gardenHarvested: 'gardenHarvested',
  herbCount: 'herbCount',
  craftCount: 'craftCount',
  nailCare: 'nailCare',
  deworm: 'deworm',
  rehomeCount: 'rehomeCount',
  rehomeCoins: 'rehomeCoins',
} as const;

export type CounterKey = (typeof COUNTER_KEYS)[keyof typeof COUNTER_KEYS];

/** 累加一次（或指定次数）并立即落盘；负数与 0 视为无操作，返回当前值。 */
export function bumpCounter(key: CounterKey, amount = 1): number {
  const step = Math.max(0, Math.round(amount));
  if (step === 0) {
    return counterValue(key);
  }
  Save.load();
  let next = 0;
  Save.mutate((data) => {
    next = (data.counters[key] ?? 0) + step;
    data.counters[key] = next;
  });
  return next;
}

/** 只读：旧档没有该 key 时按 0，成就页据此显示进度。 */
export function counterValue(key: string): number {
  Save.load();
  return Save.snapshot().counters[key] ?? 0;
}
