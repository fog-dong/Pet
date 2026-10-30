// STATUS: implemented, W16 宠物形象挂载（pets.json 配色 + 缺配置兜底）
import { Graphics, Node, UITransform } from 'cc';
import { CharacterConfig } from '../config/CharacterConfig';
import { addLabel, hexToColor, PALETTE } from '../ui/SceneUI';
import { drawAvatar, FALLBACK_COLOR } from './CharacterLook';
import type { CharacterShape } from './CharacterLook';

/**
 * 场景里不预置角色节点：进页时按 pets.json 现画一个色块形象。
 * 配置没加载或 petId 对不上时画灰块并标「未知宠物」，绝不留白。
 */
export function mountPetAvatar(parent: Node, petId: string, x: number, y: number, size: number): Node {
  const node = new Node('PetAvatar');
  node.parent = parent;
  node.setPosition(x, y, 0);
  node.addComponent(UITransform).setContentSize(size, size);
  const pet = CharacterConfig.petById(petId);
  const shape: CharacterShape = pet ? pet.baseLook.shape : 'square';
  drawAvatar(node.addComponent(Graphics), hexToColor(pet?.baseLook.color ?? '', FALLBACK_COLOR), shape, size);
  addLabel(node, 'PetAvatarName', pet ? `${pet.name} · ${pet.breed}` : '未知宠物', -size / 2 - 24, {
    size: 22,
    color: PALETTE.sub,
    width: size + 60,
  });
  return node;
}
