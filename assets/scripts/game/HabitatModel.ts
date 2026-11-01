// STATUS: implemented, W20-2 小屋数据层（从本地存档读领养宠物，缺条目按品种初始值补种并落盘）
import { HabitatPet, seedHabitat } from '../cache/HabitatCodec';
import { Save } from '../cache/Save';
import { CharacterConfig } from '../config/CharacterConfig';

/**
 * 读小屋成员。habitat 字段是 W20 才加的，老存档里只有 petsAdopted；
 * 这里按 petsAdopted 补齐缺失条目并立刻写回，所以不会出现「图鉴已领养、小屋里缺席」。
 */
export function habitatList(): HabitatPet[] {
  const missing = missingEntries();
  if (missing.length > 0) {
    Save.mutate((data) => {
      missing.forEach((petId) => data.habitat.push(seedHabitat(petId, CharacterConfig.petById(petId))));
    });
  }
  return Save.snapshot().habitat;
}

function missingEntries(): string[] {
  const save = Save.snapshot();
  return save.petsAdopted.filter((petId) => !save.habitat.some((entry) => entry.petId === petId));
}
