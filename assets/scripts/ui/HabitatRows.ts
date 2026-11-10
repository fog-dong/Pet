// STATUS: implemented, W25 P0-B 小屋成员卡片（立绘 104→190 + 图标即按钮 + 卡内高级粮小键；点行开弹窗的旧链已删）
// 几何口径见 docs/plan/可玩性升级实施方案.md §3.1：卡片节点高 210、列表间距 226，左立绘右两栏。
// 数值一律不写在 UI 里：动作、价格、每日次数仍由 game/HabitatRules 与 game/HabitatModel 决定。
import { Color, Label, Node } from 'cc';
import { HabitatPet } from '../cache/HabitatCodec';
import { CharacterConfig } from '../config/CharacterConfig';
import { getLifeStage } from '../game/AgeSystem';
import { HabitatAction, HabitatStatKey } from '../game/HabitatRules';
import type { PetState } from '../game/CharacterLook';
import { petMoodState } from '../game/PetMood';
import { PetVisual } from '../game/PetVisual';
import { addLabel, addRect } from './SceneUI';
import { addLifeBar, addLifeCompact, addStageTag } from './LifeBadge';
import { StatRow, STAT_ORDER, addStatBlock } from './HabitatBars';
import { addPremiumChip, bindChipPress } from './HabitatChip';
import { addActionChips } from './HabitatActionChips';
import { STAT_ACTION, bindTapOrHold, bindTapZone, shortfallText } from './HabitatTapActions';
import type { Point } from './ParticleKit';

/** 列表间距：卡片节点 210 + 16 呼吸，比旧版 150 高一档，换来 190 的立绘。 */
export const HABITAT_CARD_H = 226;
const NODE_H = 210;
const CARD_BG = new Color(249, 239, 222, 255);
const PORTRAIT = 190;
const PORTRAIT_X = -185;
const PORTRAIT_Y = 2;
const NAME_X = 41;
const NAME_W = 218;
const NAME_Y = 86;
const TAG_X = 236;
const LIFE_X = 7;
const LIFE_Y = 48;
const ICON_X = -46;
const STAT_LEFT = -16;
const STAT_WIDTH = 160;
const STAT_TOP = 4;
const CHIP_X = 204;
/** 高级粮上移一档，给"护理 / 送养"两枚小键腾出下半栏；三者的 x 都贴右沿，不压属性条。 */
const CHIP_Y = 30;
/** 【护理】中心，与属性行同一列；【送养】在它下方 40。 */
const ACTION_TOP = -16;
/** 三行进度条最低一行在 -56，底部进度条要留出 30 的间距才不粘连。 */
const LIFE_BAR_Y = -86;

export type HabitatStats = Record<HabitatStatKey, StatRow>;

export interface HabitatRow {
  entry: HabitatPet;
  node: Node;
  visual: PetVisual;
  stats: HabitatStats;
  /** 立绘中心，卡片局部坐标；反馈层由触点侧换算到遮罩坐标。 */
  portrait: Point;
  /** 各动作的起飞点（卡片局部坐标）：道具从被点的那枚按钮飞出去，才读得出因果。 */
  origins: Record<HabitatAction, Point>;
  /** 买不起/次数用尽的档位变暗（决策-6b 的替代形态：动作名不写在按钮上，所以改画透明度）。 */
  syncAfford(): void;
}

/** 触点只做转发，扣费与判定全在数据层；origin 与 touchX 让反馈层能演抛物线和形变方向。 */
export type RowAction = (row: HabitatRow, action: HabitatAction, origin: Point, touchX: number) => void;

/** 护理 / 送养只带行本身：两套面板各自从 petId 重新取数，不在这里传业务字段。 */
export type RowCommand = (row: HabitatRow) => void;

export function buildHabitatRow(
  parent: Node,
  index: number,
  entry: HabitatPet,
  cardWidth: number,
  onAction: RowAction,
  onCare: RowCommand,
  onRehome: RowCommand,
  cardColor: Color = CARD_BG,
): HabitatRow {
  const y = -(index * HABITAT_CARD_H) - HABITAT_CARD_H / 2;
  const card = addRect(parent, `HabitatCard_${entry.petId}`, y, cardWidth, NODE_H, cardColor);
  const look = CharacterConfig.petById(entry.petId);
  const visual = PetVisual.mount(card, PORTRAIT, false);
  visual.node.name = `HabitatPortrait_${entry.petId}`;
  visual.node.setPosition(PORTRAIT_X, PORTRAIT_Y, 0);
  visual.apply(entry.petId);
  visual.playState(cardState(entry), true);

  addLabel(card, 'HabitatName', look ? look.name : entry.petId, NAME_Y, {
    size: 26,
    width: NAME_W,
    x: NAME_X,
    align: Label.HorizontalAlign.LEFT,
  });
  addStageTag(card, getLifeStage(entry.birthTimestamp, look), TAG_X, NAME_Y);
  addLifeCompact(card, `HabitatLife_${entry.petId}`, LIFE_X, LIFE_Y, entry, look);
  addLifeBar(card, `HabitatLifeBar_${entry.petId}`, cardWidth - 32, LIFE_BAR_Y, entry, look);

  const block = addStatBlock(card, entry.petId, ICON_X, STAT_LEFT, STAT_TOP, STAT_WIDTH);
  const origins: Record<HabitatAction, Point> = {
    feed: block.origins.hunger,
    bath: block.origins.cleanliness,
    pet: block.origins.mood,
    premium: { x: CHIP_X, y: CHIP_Y },
  };
  const chip = addPremiumChip(card, entry.petId, CHIP_X, CHIP_Y, (touchX) => {
    onAction(row, 'premium', origins.premium, touchX);
  });
  const chips = addActionChips(card, entry.petId, CHIP_X, ACTION_TOP, () => onCare(row), () => onRehome(row));
  const row: HabitatRow = {
    entry,
    node: card,
    visual,
    stats: block.rows,
    portrait: { x: PORTRAIT_X, y: PORTRAIT_Y },
    origins,
    syncAfford(): void {
      STAT_ORDER.forEach((key) => block.rows[key].setAffordable(shortfallText(STAT_ACTION[key]) === null));
      chip.sync();
      chips.sync();
    },
  };
  // 三枚图标钮各走自己的动作；立绘短按=抚摸、长按=高级粮（拍板-3：长按只是快捷方式，小键仍在）。
  STAT_ORDER.forEach((key) => {
    const action = STAT_ACTION[key];
    bindTapZone(block.zones[key], (touchX) => onAction(row, action, origins[action], touchX));
    // 热区是自建 Graphics 圆钮，没有 cc.Button，按压动画只能自己补上——否则点下去没有任何"碰到了"的回话。
    bindChipPress(block.zones[key]);
  });
  bindTapOrHold(
    visual.node,
    (touchX) => onAction(row, 'pet', origins.pet, touchX),
    () => onAction(row, 'premium', origins.premium, 0),
  );
  row.syncAfford();
  applyStats(row.stats, entry);
  return row;
}

export function applyStats(stats: HabitatStats, entry: HabitatPet): void {
  STAT_ORDER.forEach((key) => stats[key].update(entry[key]));
}

/** 卡片是可停留的看护界面：饿了趴着睡、平时踱两步；happy 的跳跃留给大厅散步带，多张卡片同时跳会抢按钮。 */
function cardState(entry: HabitatPet): PetState {
  const mood = petMoodState(entry);
  return mood === 'happy' ? 'idle' : mood;
}
