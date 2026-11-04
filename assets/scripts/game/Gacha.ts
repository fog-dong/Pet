// STATUS: implemented, W25 P1-A 寻访结果判定（新宠记图鉴，重复宠按稀有度转金币/爱心，不新增存档字段）
import { Save } from '../cache/Save';
import { CharacterConfig } from '../config/CharacterConfig';
import { GachaConfig, GachaTier } from '../config/GachaConfig';
import { Track } from '../track/Track';

export interface GachaDraw {
  petId: string;
  petName: string;
  breed: string;
  tier: GachaTier;
  tierName: string;
  tint: string;
  isNew: boolean;
  coins: number;
  hearts: number;
}

/** 已救助（petsAdopted）与已遇见（petsSeen）都算见过，只有完全陌生的才进接诊。 */
export function drawGacha(): GachaDraw | null {
  const roll = GachaConfig.roll();
  if (!roll) {
    return null;
  }
  Save.load();
  const state = Save.snapshot();
  const isNew = !state.petsSeen.includes(roll.petId) && !state.petsAdopted.includes(roll.petId);
  if (isNew) {
    Save.markSeen(roll.petId);
  } else {
    Save.addCoins(roll.duplicate.coins);
    Save.addHearts(roll.duplicate.hearts);
  }
  const pet = CharacterConfig.petById(roll.petId);
  Track.track(isNew ? 'gacha_new' : 'gacha_duplicate', {
    petId: roll.petId,
    tier: roll.tier,
    coins: isNew ? 0 : roll.duplicate.coins,
    hearts: isNew ? 0 : roll.duplicate.hearts,
  });
  return {
    petId: roll.petId,
    petName: pet ? pet.name : '神秘小动物',
    breed: pet ? pet.breed : '等待确认品种',
    tier: roll.tier,
    tierName: roll.tierName,
    tint: roll.tint,
    isNew,
    coins: isNew ? 0 : roll.duplicate.coins,
    hearts: isNew ? 0 : roll.duplicate.hearts,
  };
}
