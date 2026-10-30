// STATUS: implemented, W16 宠物立绘挂载（贴图 + 名字，缺图由 PetVisual 兜底）
import { Node } from 'cc';
import { CharacterConfig } from '../config/CharacterConfig';
import { addLabel, PALETTE } from '../ui/SceneUI';
import { PetVisual } from './PetVisual';

/**
 * 场景里不预置角色节点：进页时挂一个立绘位，贴图从 art 分包异步补上。
 * 配置或图片缺失时显示占位块，绝不留白。
 */
export function mountPetAvatar(parent: Node, petId: string, x: number, y: number, size: number): Node {
  const visual = PetVisual.mount(parent, size);
  visual.node.setPosition(x, y, 0);
  visual.apply(petId);
  const pet = CharacterConfig.petById(petId);
  addLabel(visual.node, 'PetAvatarName', pet ? `${pet.name} · ${pet.breed}` : '未知宠物', -size / 2 - 24, {
    size: 22,
    color: PALETTE.sub,
    width: size + 60,
  });
  return visual.node;
}
