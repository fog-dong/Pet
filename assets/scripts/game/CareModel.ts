// STATUS: implemented, W25 P2-D 护理公共取数与结算（剪指甲/驱虫共用；属性只写本地，偏差 D19 不变）
import { clampStat, HabitatPet, STAT_MAX } from '../cache/HabitatCodec';
import { Save } from '../cache/Save';
import { habitatList } from './HabitatModel';

/** 读宠物并顺带结算衰减；找不到说明还没领养。 */
export function findCareEntry(petId: string): HabitatPet | null {
  return habitatList().find((entry) => entry.petId === petId) ?? null;
}

/** 两项收益都到顶就不必再花资源，给一句与互动表同风格的提示。 */
export function fullCareText(entry: HabitatPet): string | null {
  return entry.cleanliness >= STAT_MAX && entry.mood >= STAT_MAX ? '已经很干净啦' : null;
}

/** 按增量写三项里的两项（另一项传 0），返回结算后的条目供 UI 刷新。 */
export function applyCareStats(petId: string, cleanGain: number, moodGain: number): HabitatPet | null {
  Save.mutate((data) => {
    const target = data.habitat.find((item) => item.petId === petId);
    if (!target) {
      return;
    }
    target.cleanliness = clampStat(target.cleanliness + cleanGain);
    target.mood = clampStat(target.mood + moodGain);
  });
  return Save.snapshot().habitat.find((item) => item.petId === petId) ?? null;
}
