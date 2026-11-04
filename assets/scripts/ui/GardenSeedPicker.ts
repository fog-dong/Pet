// STATUS: implemented, W25 P2-C 选种弹层（三行种子点击即播种；取消只清遮罩，不扣金币）
import { BlockInputEvents, Node, UITransform } from 'cc';
import { GardenConfig } from '../config/GardenConfig';
import { formatRemaining } from '../game/GardenRules';
import { addCard } from './PanelKit';
import { addLabel, addRect } from './SceneUI';
import { addUIButton } from './UIButton';
import { COLORS } from './Tokens';

let active: Node | null = null;

export function closeSeedPicker(): void {
  if (active) {
    active.destroy();
    active = null;
  }
}

/** 挂在面板上而不是地块上：遮罩要盖住页签，选种期间不允许切页。 */
export function openSeedPicker(host: Node, onPick: (cropId: string) => void): void {
  closeSeedPicker();
  const size = host.getComponent(UITransform)?.contentSize;
  const width = size?.width ?? 660;
  const height = size?.height ?? 800;
  const shade = addRect(host, 'SeedPickerShade', 0, width, height, COLORS.overlay);
  shade.addComponent(BlockInputEvents);
  shade.setSiblingIndex(host.children.length - 1);
  active = shade;
  const card = addCard(shade, 'SeedPickerCard', 0, 540, 430, { color: COLORS.paper });
  addLabel(card, 'SeedTitle', '选一包种子', 168, { size: 28 });
  addLabel(card, 'SeedHint', '种子费与成熟时间，收获直接进背包', 128, { size: 16, color: COLORS.sub, width: 470 });
  GardenConfig.crops.forEach((crop, index) => {
    addUIButton(
      card,
      `SeedPick_${crop.id}`,
      `${crop.name}　${crop.seedCoins} 金 · ${formatRemaining(crop.growMinutes * 60000)} · 产 ${crop.yield}`,
      () => {
        closeSeedPicker();
        onPick(crop.id);
      },
      { y: 72 - index * 84, width: 470, height: 70, color: COLORS.sage, fontSize: 20 },
    );
  });
  addUIButton(card, 'SeedCancel', '再想想', closeSeedPicker, {
    y: -164,
    width: 280,
    height: 56,
    color: COLORS.sub,
    fontSize: 22,
  });
}
