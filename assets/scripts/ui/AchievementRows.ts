// STATUS: implemented, W25 P2-B2 成就行（六组卡片 × 三档按钮；领取后由面板整体重绘，不做局部刷新）
import { Label, Node, UITransform } from 'cc';
import { COPY, fillCopy } from '../config/CopyText';
import type { GroupView, TierView } from '../game/AchievementRules';
import { rewardText } from '../game/AchievementText';
import { makeLabel } from './FontKit';
import { addCard, addPill } from './PanelKit';
import { fitRow, RowSpan } from './ScreenMetrics';
import { COLORS } from './Tokens';
import { addUIButton } from './UIButton';

const CARD_H = 168;
const CARD_GAP = 14;
const CHIP_H = 54;

export function renderAchievementRows(
  host: Node,
  previous: Node | null,
  views: readonly GroupView[],
  onClaim: (id: string) => void,
): Node {
  if (previous && previous.isValid) {
    previous.destroy();
  }
  const root = new Node('AchievementRows');
  root.parent = host;
  const width = host.getComponent(UITransform)?.contentSize.width ?? 600;
  const transform = root.addComponent(UITransform);
  transform.setContentSize(width, Math.max(1, views.length) * (CARD_H + CARD_GAP) - CARD_GAP);
  transform.setAnchorPoint(0.5, 1);
  views.forEach((group, index) => renderCard(root, group, index, width, onClaim));
  return root;
}

function renderCard(
  root: Node,
  group: GroupView,
  index: number,
  width: number,
  onClaim: (id: string) => void,
): void {
  const cardW = width - 12;
  const y = -index * (CARD_H + CARD_GAP) - CARD_H / 2;
  const card = addCard(root, `AchievementCard-${group.id}`, y, cardW, CARD_H, { shadow: false });
  const name = makeLabel(card, 'AchievementGroupName', group.name, CARD_H / 2 - 34, {
    size: 26,
    width: 200,
    x: -cardW / 2 + 110,
    color: COLORS.ink,
  });
  name.horizontalAlign = Label.HorizontalAlign.LEFT;
  const stat = group.nextNeed === null
    ? COPY.achievementAllClaimed
    : fillCopy(COPY.achievementProgress, { value: group.value, need: group.nextNeed });
  const progress = makeLabel(card, `AchievementProgress-${group.id}`, stat, CARD_H / 2 - 34, {
    size: 22,
    width: 260,
    x: cardW / 2 - 140,
    color: COLORS.sub,
  });
  progress.horizontalAlign = Label.HorizontalAlign.RIGHT;
  const hint = hintText(group);
  if (hint) {
    makeLabel(card, `AchievementHint-${group.id}`, hint, CARD_H / 2 - 70, {
      size: 18,
      width: cardW - 40,
      color: COLORS.sub,
    });
  }
  const span = fitRow(3, -cardW / 2 + 26, cardW / 2 - 26, 12);
  group.tiers.forEach((tier, i) => renderChip(card, group, tier, i, span, -CARD_H / 2 + 36, onClaim));
}

/** 有可领档位就先说奖励，没有就提示下一档门槛；全领完留空，不写「下一档」。 */
function hintText(group: GroupView): string {
  const claimable = group.tiers.filter((tier) => tier.status === 'claimable');
  if (claimable.length > 0) {
    return claimable.map((tier) => rewardText(tier.reward)).join('　');
  }
  const next = group.tiers.find((tier) => tier.status !== 'claimed');
  if (!next) {
    return '';
  }
  const reward = rewardText(next.reward);
  return reward
    ? fillCopy(COPY.achievementNext, { need: next.need, reward })
    : fillCopy(COPY.achievementNextOnly, { need: next.need });
}

function renderChip(
  card: Node,
  group: GroupView,
  tier: TierView,
  index: number,
  span: RowSpan,
  y: number,
  onClaim: (id: string) => void,
): void {
  const name = `AchievementChip-${group.id}-${index}`;
  const x = span.x0 + index * span.step;
  const tierName = COPY.achievementTierNames[index] ?? index + 1;
  if (tier.status === 'claimable') {
    addUIButton(card, name, `${tierName} · ${COPY.achievementClaim}`, () => onClaim(tier.id), {
      x,
      y,
      width: span.width,
      height: CHIP_H,
      color: COLORS.gold,
      fontSize: 22,
    });
    return;
  }
  const claimed = tier.status === 'claimed';
  const pill = addPill(card, name, y, span.width, CHIP_H, claimed ? COLORS.sage : COLORS.floor, x);
  makeLabel(pill, `${name}Label`, claimed ? `${tierName} · ${COPY.achievementClaimed}` : `${tierName} · ${tier.need}`, 0, {
    size: 22,
    width: span.width - 12,
    color: claimed ? COLORS.white : COLORS.sub,
  });
}
