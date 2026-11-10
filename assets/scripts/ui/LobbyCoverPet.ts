// STATUS: implemented, W32-2 封面宠：最近领养的一只站在医生右侧柜台后，习性动作常开，点它直接进小屋
// 与散步带分工：封面宠是「最新到家」的门面，散步带只演最需要照顾的那两只，同一只不会同屏出现两次。
import type { Node } from 'cc';
import { HabitatPet } from '../cache/HabitatCodec';
import { petMoodState } from '../game/PetMood';
import { PetVisual } from '../game/PetVisual';
import { lobbyCoverPetSize, lobbyCoverPetX, lobbyCoverPetY } from './LobbyDockLayout';
import { bindPetTap } from './LobbyPetRow';
import { playStaggerIn } from './MotionKit';
import { createNode } from './SceneUI';
import { DURATION } from './Tokens';

export interface CoverPetHandle {
  /** 返回当前上台的 petId（无宠为 null）：散步带据此避让，避免同一只同屏两次。 */
  refresh(entries: readonly HabitatPet[]): string | null;
}

/** 进屋时间最晚的一只；老档 birthTimestamp 相同则取列表末位（新领养的总是追加在尾部）。 */
export function newestPet(entries: readonly HabitatPet[]): HabitatPet | null {
  let best: HabitatPet | null = null;
  for (const entry of entries) {
    if (!best || entry.birthTimestamp >= best.birthTimestamp) {
      best = entry;
    }
  }
  return best;
}

export function mountCoverPet(parent: Node, onPick: (petId: string) => void): CoverPetHandle {
  const size = lobbyCoverPetSize();
  const slot = createNode(parent, 'LobbyCoverPetSlot', lobbyCoverPetY(), size, size);
  slot.setPosition(lobbyCoverPetX(), lobbyCoverPetY(), 0);
  let key = '';
  let shown: string | null = null;
  return {
    refresh(entries: readonly HabitatPet[]): string | null {
      const pet = newestPet(entries);
      if (!pet) {
        if (shown !== null) {
          slot.destroyAllChildren();
          key = '';
          shown = null;
        }
        return null;
      }
      // 心情档变了要换姿态；同一只同一档就别重建，否则每次刷资源都在重播入场。
      const next = `${pet.petId}:${petMoodState(pet)}`;
      if (next === key) {
        return shown;
      }
      key = next;
      shown = pet.petId;
      slot.destroyAllChildren();
      // 不画地面阴影：脚在柜台前板后面，阴影只会在台面上留一块灰。
      const visual = PetVisual.mount(slot, size, false);
      visual.node.name = `LobbyCoverPet_${pet.petId}`;
      visual.apply(pet.petId);
      visual.playState(petMoodState(pet), true);
      bindPetTap(visual.node, () => onPick(pet.petId));
      playStaggerIn([visual.node], { duration: DURATION.bandIn, easing: 'backOut' });
      return shown;
    },
  };
}
