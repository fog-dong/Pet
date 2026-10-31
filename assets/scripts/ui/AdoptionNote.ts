// STATUS: implemented, W18 领养页寄语 + 性格标签（pets.json 缺失时按 petId 稳定轮换占位）
import { Color, Node } from 'cc';
import { PetConfigItem } from '../config/CharacterConfig';
import { addCard, addPill } from './PanelKit';
import { addLabel } from './SceneUI';
import { COLORS } from './Tokens';

const TRAIT_POOL = ['粘人', '活泼', '胆小', '贪吃', '傲娇', '爱撒娇', '安静', '好奇'];
const MESSAGE_POOL = [
  '把它带回家后，它每天都会蹲在门口等你下班。',
  '它已经把你的白大褂，当成最安心的味道。',
  '治疗时它一直忍着不叫，是怕你担心。',
  '它最想做的第一件事，是蹭蹭你的手心。',
];

const CHIP_W = 118;
const CHIP_H = 46;
const CHIP_GAP = 14;
const CHIP_BG = new Color(250, 234, 220, 255);

function seedOf(text: string): number {
  let seed = 7;
  for (let index = 0; index < text.length; index += 1) {
    seed = (seed * 31 + text.charCodeAt(index)) >>> 0;
  }
  return seed;
}

/** 配置优先；没有配置就按 petId 稳定抽 2–3 个标签，换设备看到的也一致。 */
export function adoptionTraits(pet: PetConfigItem | null, petId: string): string[] {
  const configured = (pet?.traits ?? []).filter((item) => !!item);
  if (configured.length > 0) {
    return configured.slice(0, 3);
  }
  const seed = seedOf(petId);
  const count = 2 + (seed % 2);
  const picked: string[] = [];
  for (let index = 0; index < count; index += 1) {
    let cursor = (seed + index * 3) % TRAIT_POOL.length;
    while (picked.includes(TRAIT_POOL[cursor])) {
      cursor = (cursor + 1) % TRAIT_POOL.length;
    }
    picked.push(TRAIT_POOL[cursor]);
  }
  return picked;
}

export function adoptionMessage(pet: PetConfigItem | null, petId: string): string {
  const configured = pet?.message ?? '';
  if (configured) {
    return configured;
  }
  return MESSAGE_POOL[seedOf(petId) % MESSAGE_POOL.length];
}

/** 性格标签一排居中，放在好感度条下方。 */
export function buildTraitRow(card: Node, traits: readonly string[], y: number): void {
  const total = traits.length * CHIP_W + Math.max(0, traits.length - 1) * CHIP_GAP;
  let x = -total / 2 + CHIP_W / 2;
  for (const trait of traits) {
    const chip = addPill(card, `Trait_${trait}`, y, CHIP_W, CHIP_H, CHIP_BG, x);
    addLabel(chip, 'TraitText', trait, 0, { size: 21, color: COLORS.clay, width: CHIP_W - 16 });
    x += CHIP_W + CHIP_GAP;
  }
}

/** 领养寄语卡：补足头部卡与操作区之间的空白，让领养页有“内容”。 */
export function buildAdoptionMessage(body: Node, pet: PetConfigItem | null, petId: string, y: number): void {
  const card = addCard(body, 'AdoptionMessage', y, 620, 128, { shadow: false });
  addLabel(card, 'MessageCaption', '领养寄语', 38, { size: 20, color: COLORS.gold, width: 560 });
  addLabel(card, 'MessageText', adoptionMessage(pet, petId), -12, {
    size: 23,
    color: COLORS.sub,
    width: 560,
  });
}
