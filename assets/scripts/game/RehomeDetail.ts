// STATUS: implemented, W25 P2-D 送养面板明细取数（复用 thanksParts，UI 不再复算经济公式）
import { GachaConfig } from '../config/GachaConfig';
import { RehomeConfig } from '../config/RehomeConfig';
import { counterValue } from './Counters';
import { Hospital } from './Hospital';
import { RehomeQuote } from './RehomeModel';
import { thanksParts } from './RehomeRules';

export interface RehomeDetail {
  affection: number;
  bonus: number;
  scale: number;
  generation: number;
  tierName: string;
}

export function rehomeDetail(quote: RehomeQuote): RehomeDetail {
  const config = RehomeConfig.value;
  const affection = Hospital.affection(quote.petId);
  const generation = counterValue('rehomeCount');
  const parts = thanksParts(quote.tierBase, affection, generation, config);
  return {
    affection,
    bonus: parts.bonus,
    scale: parts.scale,
    generation,
    tierName: GachaConfig.tierNameOf(quote.petId),
  };
}
