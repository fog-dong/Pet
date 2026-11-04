// STATUS: implemented, W25 P2-D 剪指甲（点 4 个红点：全中点完才算完成，点错心情 -10 并占掉当日次数）
import { Save } from '../cache/Save';
import { CareQuota } from '../cache/CareQuota';
import { GroomingConfig } from '../config/GroomingConfig';
import { applyCareStats, findCareEntry, fullCareText } from './CareModel';
import { CareOutcome } from './CareRules';
import { bumpCounter } from './Counters';

/** 只读：返回置灰原因，null 表示可以开始（金币与次数在开场时校验，结算才扣）。 */
export function nailStatus(petId: string): string | null {
  const entry = findCareEntry(petId);
  if (!entry) {
    return '这只宠物还没领养';
  }
  const { dailyLimit, costCoins } = GroomingConfig.nail;
  return CareQuota.shortfall('nail', '剪指甲', dailyLimit)
    ?? (costCoins > 0 && Save.coins < costCoins ? `金币不足（需 ${costCoins}）` : null)
    ?? fullCareText(entry);
}

/** 4 个红点全部点中：扣 15 金币，清洁 +12 / 心情 +8，占用一次当日次数。 */
export function finishNailCare(petId: string): CareOutcome {
  const blocked = nailStatus(petId);
  if (blocked) {
    return { kind: 'blocked', text: blocked };
  }
  const { costCoins, cleanGain, moodGain, dailyLimit } = GroomingConfig.nail;
  if (costCoins > 0 && !Save.spendCoins(costCoins)) {
    return { kind: 'blocked', text: `金币不足（需 ${costCoins}）` };
  }
  const entry = applyCareStats(petId, cleanGain, moodGain);
  if (!entry) {
    return { kind: 'blocked', text: '这只宠物还没领养' };
  }
  CareQuota.consume('nail', dailyLimit);
  bumpCounter('nailCare');
  return { kind: 'done', entry, text: `指甲剪好了：清洁 +${cleanGain}，心情 +${moodGain}` };
}

/**
 * 点错红点：心情 -10 并中断本局。占用一次当日次数但不扣金币——
 * 否则玩家点歪一次就白花 15 金币，比「今天少一次护理」更挫败。
 */
export function failNailCare(petId: string): CareOutcome {
  const entry = findCareEntry(petId);
  if (!entry) {
    return { kind: 'blocked', text: '这只宠物还没领养' };
  }
  const { wrongMoodLoss, dailyLimit } = GroomingConfig.nail;
  const updated = applyCareStats(petId, 0, -wrongMoodLoss) ?? entry;
  CareQuota.consume('nail', dailyLimit);
  return { kind: 'failed', entry: updated, text: `剪刀歪了，宠物吓了一跳（心情 -${wrongMoodLoss}）` };
}
