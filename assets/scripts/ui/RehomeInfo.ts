// STATUS: implemented, W25 P2-D 送养信息栏（左立绘 + 右通过率/感谢金两张卡；明细来自 RehomeDetail）
import { Node } from 'cc';
import { CharacterConfig } from '../config/CharacterConfig';
import { rehomeDetail } from '../game/RehomeDetail';
import { RehomeQuote } from '../game/RehomeModel';
import { PetVisual } from '../game/PetVisual';
import { makeLabel } from './FontKit';
import { addCard } from './PanelKit';
import { careHint, generationLabel, percent, rateTone } from './RehomeCopy';
import { COLORS } from './Tokens';

const CARD_W = 370;
const CARD_H = 160;
const CARD_X = 145;

export function buildRehomeInfo(parent: Node, petId: string, quote: RehomeQuote): void {
  const look = CharacterConfig.petById(petId);
  const detail = rehomeDetail(quote);
  const visual = PetVisual.mount(parent, 220, true);
  visual.node.setPosition(-180, 160, 0);
  visual.apply(petId);
  makeLabel(parent, 'RehomeName', look ? look.name : petId, -10, { size: 28, x: -180, width: 300 });
  makeLabel(parent, 'RehomeTier', [detail.tierName, generationLabel(detail.generation)].filter(Boolean).join(' · '), -50, {
    size: 18,
    x: -180,
    width: 300,
    color: COLORS.sub,
  });
  makeLabel(parent, 'RehomeAffection', `好感度 ${detail.affection}`, -82, {
    size: 18,
    x: -180,
    width: 300,
    color: COLORS.sub,
  });

  const rateCard = addCard(parent, 'RehomeRateCard', 160, CARD_W, CARD_H, { x: CARD_X, color: COLORS.white });
  makeLabel(rateCard, 'RehomeRateTitle', '审核通过率', 52, { size: 18, color: COLORS.sub });
  makeLabel(rateCard, 'RehomeRateValue', percent(quote.rate), 6, {
    size: 44,
    color: rateTone(quote.rate),
  });
  makeLabel(rateCard, 'RehomeRateHint', careHint(quote.rate), -46, {
    size: 16,
    width: CARD_W - 30,
    color: rateTone(quote.rate),
  });

  const thanksCard = addCard(parent, 'RehomeThanksCard', -20, CARD_W, CARD_H, { x: CARD_X, color: COLORS.white });
  makeLabel(thanksCard, 'RehomeThanksTitle', '感谢金', 52, { size: 18, color: COLORS.sub });
  makeLabel(thanksCard, 'RehomeThanksValue', `+${quote.thanks} 金币`, 8, { size: 38, color: COLORS.gold });
  makeLabel(
    thanksCard,
    'RehomeThanksDetail',
    `档位 ${quote.tierBase} + 好感 ${detail.bonus} × ${detail.scale.toFixed(2)}`,
    -46,
    { size: 15, width: CARD_W - 30, color: COLORS.sub },
  );
}
