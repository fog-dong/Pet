// STATUS: implemented, W20-2 小屋成员卡片（现成立绘 + 阶段标签 + 三项属性条 + 底部陪伴进度条；缺图由 PetVisual 自带占位块顶上）
import { Color, EventTouch, Label, Node } from 'cc';
import { HabitatPet } from '../cache/HabitatCodec';
import { CharacterConfig } from '../config/CharacterConfig';
import { getLifeStage } from '../game/AgeSystem';
import { PetVisual } from '../game/PetVisual';
import { addLabel, addRect } from './SceneUI';
import { addLifeBar, addStageTag } from './LifeBadge';
import { addStatColumns, StatRow } from './HabitatBars';

export const HABITAT_CARD_H = 150;
const CARD_BG = new Color(249, 239, 222, 255);
const PORTRAIT = 104;
/** 属性块：标签列宽 88 + 轨道 200，轨道左沿固定在 x=-44。 */
const STAT_LEFT = -44;
const STAT_WIDTH = 200;
/** 名字左沿与属性标签列（-140）对齐，标签右沿与属性轨道右端（156）对齐，两列都落在既有栅格上。 */
const NAME_X = -26;
const NAME_W = 228;
const NAME_Y = 34;
const TAG_X = 125;
/** 卡片竖直范围 ±69，心情条底沿 -63，所以 -67 是既不压条也不贴边的唯一落点。 */
const LIFE_Y = -67;
/** 列表要能上下拖，位移超过这个阈值算滚动而不是点选。 */
const TAP_SLOP = 24;

export interface HabitatRow {
  entry: HabitatPet;
  node: Node;
  visual: PetVisual;
  stats: Record<'hunger' | 'cleanliness' | 'mood', StatRow>;
}

export function buildHabitatRow(
  parent: Node,
  index: number,
  entry: HabitatPet,
  cardWidth: number,
  onTap: (row: HabitatRow) => void,
): HabitatRow {
  const y = -(index * HABITAT_CARD_H) - HABITAT_CARD_H / 2;
  const card = addRect(parent, `HabitatCard_${entry.petId}`, y, cardWidth, HABITAT_CARD_H - 12, CARD_BG);
  const visual = PetVisual.mount(card, PORTRAIT, false);
  visual.node.setPosition(-cardWidth / 2 + 70, 0, 0);
  visual.apply(entry.petId);
  const look = CharacterConfig.petById(entry.petId);
  addLabel(card, 'HabitatName', look ? `${look.name} · ${look.breed}` : entry.petId, NAME_Y, {
    size: 26,
    width: NAME_W,
    x: NAME_X,
    align: Label.HorizontalAlign.LEFT,
  });
  addStageTag(card, getLifeStage(entry.birthTimestamp, look), TAG_X, NAME_Y);
  const stats = addStatColumns(card, `HabitatStat${index}`, STAT_LEFT, 4, STAT_WIDTH);
  applyStats(stats, entry);
  addLifeBar(card, `HabitatLife${index}`, cardWidth - 32, LIFE_Y, entry, look);
  const row: HabitatRow = { entry, node: card, visual, stats };
  bindTap(card, () => onTap(row));
  return row;
}

export function applyStats(
  stats: Record<'hunger' | 'cleanliness' | 'mood', StatRow>,
  entry: HabitatPet,
): void {
  stats.hunger.update(entry.hunger);
  stats.cleanliness.update(entry.cleanliness);
  stats.mood.update(entry.mood);
}

function bindTap(card: Node, onTap: () => void): void {
  let startX = 0;
  let startY = 0;
  card.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
    const p = event.getUILocation();
    startX = p.x;
    startY = p.y;
  });
  card.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
    const p = event.getUILocation();
    if (Math.abs(p.x - startX) + Math.abs(p.y - startY) < TAP_SLOP) {
      onTap();
    }
  });
}
