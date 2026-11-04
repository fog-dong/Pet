// STATUS: implemented, W25 P2-D 护理面板左侧档案（立绘 + 名字 + 三条属性，属性每次结算后同步）
import { Label, Node } from 'cc';
import { HabitatPet } from '../cache/HabitatCodec';
import { CharacterConfig } from '../config/CharacterConfig';
import { PetVisual } from '../game/PetVisual';
import { makeLabel } from './FontKit';
import { COLORS } from './Tokens';

const STAT_NAMES = ['饱食', '清洁', '心情'] as const;

export interface CareProfileHandle {
  sync(entry: HabitatPet): void;
}

export function buildCareProfile(panel: Node, petId: string): CareProfileHandle {
  const look = CharacterConfig.petById(petId);
  const visual = PetVisual.mount(panel, 220, true);
  visual.node.setPosition(-170, 145, 0);
  visual.apply(petId);
  makeLabel(panel, 'CareName', look ? look.name : petId, -20, { size: 28, x: -170, width: 300 });
  const values: Label[] = STAT_NAMES.map((name, index) =>
    makeLabel(panel, `CareStat_${name}`, '', -62 - index * 34, { size: 18, x: -170, width: 300, color: COLORS.sub }),
  );
  return {
    sync(entry: HabitatPet): void {
      const stats = [entry.hunger, entry.cleanliness, entry.mood];
      values.forEach((label, index) => {
        if (label.isValid) {
          label.string = `${STAT_NAMES[index]} ${stats[index]}`;
        }
      });
    },
  };
}
