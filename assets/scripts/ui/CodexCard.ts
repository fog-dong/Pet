// STATUS: implemented, W25-P1 图鉴窄卡（双列 264×112，立绘 112，右上角 90×38 红戳）
import { Color, Node } from 'cc';
import { Save } from '../cache/Save';
import { PetConfigItem } from '../config/CharacterConfig';
import { PetVisual } from '../game/PetVisual';
import { addLabel, addRect, PALETTE } from './SceneUI';
import { addAdoptedStamp } from './CodexStamp';

export const CARD_W = 264;
export const CARD_H = 112;

const CARD_BG = new Color(249, 239, 222, 255);
const CARD_BG_ADOPTED = new Color(241, 222, 190, 255);
const UNSEEN_TEXT = new Color(150, 142, 134, 255);
const TEXT_X = -CARD_W / 2 + CARD_H + 8;
const TEXT_W = CARD_W - CARD_H - 16;

/** 90×38 红戳压在右上角，三行文字整体下移避让；未救助保持灰。 */
export function buildCodexCard(parent: Node, pet: PetConfigItem, x: number, y: number): Node {
  const adopted = Save.isAdopted(pet.petId);
  const seen = Save.snapshot().petsSeen.includes(pet.petId);
  const card = addRect(parent, `Card_${pet.petId}`, y, CARD_W, CARD_H, adopted ? CARD_BG_ADOPTED : CARD_BG, x);
  // 图鉴是列表页：关阴影，避免 112 卡内阴影压到相邻行。
  const visual = PetVisual.mount(card, CARD_H, false);
  visual.node.setPosition(-CARD_W / 2 + CARD_H / 2, 0, 0);
  visual.apply(pet.petId);
  const textX = TEXT_X + TEXT_W / 2;
  addLabel(card, 'Name', pet.name, 6, { size: 20, width: TEXT_W, x: textX });
  addLabel(card, 'Breed', pet.breed, -16, { size: 14, color: PALETTE.sub, width: TEXT_W, x: textX });
  const status = adopted
    ? { text: `领养于 ${Save.adoptionDate(pet.petId).slice(5)}`, color: PALETTE.primary }
    : { text: seen ? '已救助 ♥' : '未救助', color: seen ? PALETTE.sub : UNSEEN_TEXT };
  addLabel(card, 'Status', status.text, -36, { size: 14, color: status.color, width: TEXT_W, x: textX });
  if (adopted) {
    addAdoptedStamp(card, 81, 30);
  }
  return card;
}
