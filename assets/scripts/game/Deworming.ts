// STATUS: implemented, W25 P2-D 驱虫（消耗后院合成的驱虫药剂：清洁 +25 / 心情 +5，每日 1 次）
import { Save } from '../cache/Save';
import { CareQuota } from '../cache/CareQuota';
import { GroomingConfig } from '../config/GroomingConfig';
import { applyCareStats, findCareEntry, fullCareText } from './CareModel';
import { CareOutcome } from './CareRules';
import { bumpCounter } from './Counters';

/** 只读置灰原因：无药剂时明确指路去后院，不只说「不能做」。 */
export function dewormStatus(petId: string): string | null {
  const entry = findCareEntry(petId);
  if (!entry) {
    return '这只宠物还没领养';
  }
  const { dailyLimit, itemId } = GroomingConfig.deworm;
  if (CareQuota.shortfall('deworm', '驱虫', dailyLimit)) {
    return `今日驱虫次数已用完（${dailyLimit} 次）`;
  }
  if (Save.itemCount(itemId) <= 0) {
    return '没有驱虫药剂，去后院合成一支吧';
  }
  return fullCareText(entry);
}

/** 成功驱虫：扣一支药剂，清洁 +25 / 心情 +5，占用当日唯一次数。 */
export function dewormPet(petId: string): CareOutcome {
  const blocked = dewormStatus(petId);
  if (blocked) {
    return { kind: 'blocked', text: blocked };
  }
  const { itemId, cleanGain, moodGain, dailyLimit } = GroomingConfig.deworm;
  if (!Save.useItem(itemId, 1)) {
    return { kind: 'blocked', text: '没有驱虫药剂，去后院合成一支吧' };
  }
  const entry = applyCareStats(petId, cleanGain, moodGain);
  if (!entry) {
    return { kind: 'blocked', text: '这只宠物还没领养' };
  }
  CareQuota.consume('deworm', dailyLimit);
  bumpCounter('deworm');
  return { kind: 'done', entry, text: `驱虫完成：清洁 +${cleanGain}，心情 +${moodGain}` };
}
