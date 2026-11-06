// STATUS: implemented, W27 P3-UI 成就行（六组卡片 × 三档里程碑；徽章 + 里程碑专名，列表高写回 ScrollView content）
import { Color, Label, Node, UITransform } from 'cc';
import { COPY, fillCopy } from '../config/CopyText';
import type { GroupView, TierView } from '../game/AchievementRules';
import { milestoneName, rewardText } from '../game/AchievementText';
import { makeLabel } from './FontKit';
import { addCard, addPill } from './PanelKit';
import { fitRow, RowSpan } from './ScreenMetrics';
import { COLORS } from './Tokens';
import { addUIButton } from './UIButton';
import { addGlyphBadge, GlyphKind } from './GlyphKit';

const CARD_H = 184;
const CARD_GAP = 14;
const CHIP_H = 62;
const CHIP_FONT = 21;
const BADGE = 40;

/**
 * content 的高必须写成「视口高与列表高取大」：只给视口高时 ScrollView 认为没有滚动范围，
 * 一拖就把整段列表当弹性位移弹回去，看起来像「异常往上滚」。
 */
export function renderAchievementRows(
  host: Node,
  viewportH: number,
  previous: Node | null,
  views: readonly GroupView[],
  onClaim: (id: string) => void,
): Node {
  if (previous && previous.isValid) {
    previous.destroy();
  }
  const width = host.getComponent(UITransform)?.contentSize.width ?? 600;
  const listH = Math.max(1, views.length) * (CARD_H + CARD_GAP) - CARD_GAP;
  host.getComponent(UITransform)?.setContentSize(width, Math.max(viewportH, listH));
  const root = new Node('AchievementRows');
  root.parent = host;
  const transform = root.addComponent(UITransform);
  transform.setContentSize(width, listH);
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
  addGlyphBadge(card, `AchievementBadge-${group.id}`, badgeKind(group), BADGE, badgeFill(group), COLORS.white)
    .setPosition(-cardW / 2 + 34, CARD_H / 2 - 40, 0);
  const name = makeLabel(card, 'AchievementGroupName', group.name, CARD_H / 2 - 40, {
    size: 26,
    width: 186,
    x: -cardW / 2 + 154,
    color: COLORS.ink,
  });
  name.horizontalAlign = Label.HorizontalAlign.LEFT;
  const stat = group.nextNeed === null
    ? COPY.achievementAllClaimed
    : fillCopy(COPY.achievementProgress, { value: group.value, need: group.nextNeed });
  const progress = makeLabel(card, `AchievementProgress-${group.id}`, stat, CARD_H / 2 - 40, {
    size: 22,
    width: 260,
    x: cardW / 2 - 140,
    color: COLORS.sub,
  });
  progress.horizontalAlign = Label.HorizontalAlign.RIGHT;
  const hint = hintText(group);
  if (hint) {
    makeLabel(card, `AchievementHint-${group.id}`, hint, CARD_H / 2 - 76, {
      size: 18,
      width: cardW - 40,
      color: COLORS.sub,
    });
  }
  const span = fitRow(3, -cardW / 2 + 26, cardW / 2 - 26, 12);
  group.tiers.forEach((tier, i) => renderChip(card, group, tier, i, span, -CARD_H / 2 + 40, onClaim));
}

/** 领满与可领都挂奖杯（金银底分开），还在攒进度的是爪印——一眼分清「拿完了」和「在路上」。 */
function badgeKind(group: GroupView): GlyphKind {
  return group.nextNeed === null || hasOpen(group) ? 'trophy' : 'paw';
}

function badgeFill(group: GroupView): Color {
  if (group.nextNeed === null) {
    return COLORS.gold;
  }
  return hasOpen(group) ? COLORS.clay : COLORS.sage;
}

function hasOpen(group: GroupView): boolean {
  return group.tiers.some((tier) => tier.status === 'claimable');
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
  const tierName = milestoneName(group.id, index);
  if (tier.status === 'claimable') {
    addUIButton(card, name, `${tierName} · ${COPY.achievementClaim}`, () => onClaim(tier.id), {
      x,
      y,
      width: span.width,
      height: CHIP_H,
      color: COLORS.gold,
      fontSize: CHIP_FONT,
    });
    return;
  }
  const claimed = tier.status === 'claimed';
  const pill = addPill(card, name, y, span.width, CHIP_H, claimed ? COLORS.sage : COLORS.floor, x);
  makeLabel(pill, `${name}Label`, claimed ? `${tierName} · ${COPY.achievementClaimed}` : `${tierName} · ${tier.need}`, 0, {
    size: CHIP_FONT,
    width: span.width - 12,
    color: claimed ? COLORS.white : COLORS.sub,
  });
}
