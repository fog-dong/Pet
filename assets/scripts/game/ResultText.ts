// STATUS: implemented, W7 结算文案（星级与累计资源，从 Result 拆出控制行数）
import { Save } from '../cache/Save';
import { COPY, fillCopy } from '../config/CopyText';
import { CaseCrisis } from './CaseCrisis';

export function starText(stars: number): string {
  const clamped = Math.max(0, Math.min(3, stars));
  return `${'★'.repeat(clamped)}${'☆'.repeat(3 - clamped)}`;
}

export function totalText(): string {
  return `累计金币 ${Save.coins}　累计爱心 ${Save.hearts}　已治愈 ${Save.casesDone} 例`;
}

/** 转院账目：口碑只有真扣到分才追加，0 口碑的医院不会被写成本被扣负数。 */
export function transferText(): string {
  const cost = CaseCrisis.transferCost;
  const base = fillCopy(COPY.transferSummary, {
    refunded: CaseCrisis.refundedMedicines.length,
    hearts: cost.hearts,
  });
  return cost.reputation > 0
    ? `${base}，${fillCopy(COPY.transferReputation, { reputation: cost.reputation })}`
    : base;
}
