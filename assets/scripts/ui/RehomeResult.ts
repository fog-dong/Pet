// STATUS: implemented, W25 P2-D 送养结果（成功给告别文案与图鉴计数；失败说明费用不退并留在小屋）
import { BlockInputEvents, Color, Node } from 'cc';
import { Save } from '../cache/Save';
import { CharacterConfig } from '../config/CharacterConfig';
import { RehomeClaim } from '../game/RehomeModel';
import { farewell, percent, rejected } from './RehomeCopy';
import { makeLabel } from './FontKit';
import { addCard } from './PanelKit';
import { addRect } from './SceneUI';
import { screenHeight, screenWidth } from './ScreenMetrics';
import { addUIButton } from './UIButton';
import { COLORS } from './Tokens';

export function showRehomeResult(parent: Node, claim: RehomeClaim, onDismiss: () => void): Node | null {
  if (claim.kind === 'blocked') {
    return null;
  }
  const shade = addRect(parent, 'RehomeResultShade', 0, screenWidth(), screenHeight(), new Color(0, 0, 0, 120));
  shade.addComponent(BlockInputEvents);
  shade.setSiblingIndex(parent.children.length - 1);
  const card = addCard(shade, 'RehomeResultCard', 0, 560, 480, { color: COLORS.paper });
  const name = CharacterConfig.petById(claim.petId)?.name ?? claim.petId;
  if (claim.kind === 'adopted') {
    makeLabel(card, 'RehomeResultTitle', '找到新家啦', 165, { size: 34, color: COLORS.sage });
    makeLabel(card, 'RehomeFarewell', farewell(name), 75, { size: 22, width: 480 });
    makeLabel(card, 'RehomeCoins', `+${claim.coins} 金币`, -15, { size: 42, color: COLORS.gold });
    makeLabel(card, 'RehomeCodex', `图鉴已永久点亮 · 当前图鉴 ${Save.snapshot().petsAdopted.length} 只`, -80, {
      size: 17,
      width: 480,
      color: COLORS.sub,
    });
    addUIButton(card, 'RehomeResultOk', '回小屋看看', onDismiss, {
      y: -165,
      width: 300,
      height: 72,
      color: COLORS.sage,
      fontSize: 26,
    });
  } else {
    makeLabel(card, 'RehomeResultTitle', '这次没遇到合适的人家', 165, {
      size: 30,
      width: 500,
      color: COLORS.danger,
    });
    makeLabel(card, 'RehomeRejected', rejected(name), 65, { size: 22, width: 480 });
    makeLabel(card, 'RehomeRejectedRate', `本次通过率 ${percent(claim.rate)}`, -25, {
      size: 20,
      color: COLORS.sub,
    });
    addUIButton(card, 'RehomeResultOk', '继续照顾它', onDismiss, {
      y: -145,
      width: 300,
      height: 72,
      color: COLORS.clay,
      fontSize: 26,
    });
  }
  return shade;
}
