// STATUS: implemented, W20-2 小屋成员卡片（现成立绘 + 三项属性条；缺图由 PetVisual 自带占位块顶上）
import { Color, Node } from 'cc';
import { HabitatPet } from '../cache/HabitatCodec';
import { CharacterConfig } from '../config/CharacterConfig';
import { PetVisual } from '../game/PetVisual';
import { addLabel, addRect } from './SceneUI';
import { addStatColumns, StatRow } from './HabitatBars';

export const HABITAT_CARD_H = 150;
const CARD_BG = new Color(249, 239, 222, 255);
const PORTRAIT = 104;
/** 属性块：标签列宽 88 + 轨道 200，轨道左沿固定在 x=-44。 */
const STAT_LEFT = -44;
const STAT_WIDTH = 200;

export interface HabitatRow {
  stats: Record<'hunger' | 'cleanliness' | 'mood', StatRow>;
}

export function buildHabitatRow(
  parent: Node,
  index: number,
  entry: HabitatPet,
  cardWidth: number,
): HabitatRow {
  const y = -(index * HABITAT_CARD_H) - HABITAT_CARD_H / 2;
  const card = addRect(parent, `HabitatCard_${entry.petId}`, y, cardWidth, HABITAT_CARD_H - 12, CARD_BG);
  const visual = PetVisual.mount(card, PORTRAIT, false);
  visual.node.setPosition(-cardWidth / 2 + 70, 0, 0);
  visual.apply(entry.petId);
  const look = CharacterConfig.petById(entry.petId);
  addLabel(card, 'HabitatName', look ? `${look.name} · ${look.breed}` : entry.petId, 34, {
    size: 26,
    width: 300,
    x: 12,
  });
  const stats = addStatColumns(card, `HabitatStat${index}`, STAT_LEFT, 4, STAT_WIDTH);
  applyStats(stats, entry);
  return { stats };
}

export function applyStats(
  stats: Record<'hunger' | 'cleanliness' | 'mood', StatRow>,
  entry: HabitatPet,
): void {
  stats.hunger.update(entry.hunger);
  stats.cleanliness.update(entry.cleanliness);
  stats.mood.update(entry.mood);
}
