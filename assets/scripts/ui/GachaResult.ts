// STATUS: implemented, W25 P1-A 寻访结果卡（稀有度 / 名字 / 新宠或重复转化，主按钮回传面板）
import { Label, Node, UIOpacity, Vec3, tween } from 'cc';
import { COPY, fillCopy } from '../config/CopyText';
import type { GachaDraw } from '../game/Gacha';
import { addCard, addPill } from './PanelKit';
import { addLabel } from './SceneUI';
import { addUIButton } from './UIButton';
import { COLORS, tint } from './Tokens';

export interface GachaResultActions {
  primary(): void;
  secondary(): void;
}

const CARD_W = 640;
const CARD_H = 340;
const CARD_Y = -380;

export function mountGachaResult(stage: Node, draw: GachaDraw, actions: GachaResultActions): Node {
  const holder = new Node('GachaResult');
  holder.parent = stage;
  holder.setPosition(0, CARD_Y - 360, 0);
  const fade = holder.addComponent(UIOpacity);
  fade.opacity = 0;
  const card = addCard(holder, 'GachaResultCard', 0, CARD_W, CARD_H, { color: COLORS.paper });
  const pill = addPill(card, 'GachaTier', 126, 168, 46, tint(draw.tint || '#EFE2D2'));
  addLabel(pill, 'GachaTierLabel', draw.tierName, 0, { size: 24, width: 150 });
  if (draw.isNew) {
    // 新宠标记与稀有度胶囊同排右对齐，避免压在卡片上沿。
    addLabel(card, 'GachaNewTag', COPY.gachaNewTag, 126, {
      size: 18,
      color: COLORS.sub,
      width: 250,
      x: 172,
      align: Label.HorizontalAlign.RIGHT,
    });
  }
  addLabel(card, 'GachaName', draw.petName, 68, { size: 36 });
  addLabel(card, 'GachaBreed', draw.breed, 28, { size: 22, color: COLORS.sub });
  addLabel(card, 'GachaMessage', draw.isNew ? COPY.gachaNew : COPY.gachaDuplicate, -12, {
    size: 20,
    color: COLORS.sub,
    width: 540,
  });
  if (!draw.isNew) {
    addLabel(
      card,
      'GachaReward',
      fillCopy(COPY.gachaReward, { coins: draw.coins, hearts: draw.hearts }),
      -58,
      { size: 24, color: COLORS.gold },
    );
  }
  addUIButton(card, 'GachaPrimary', draw.isNew ? COPY.gachaIntake : COPY.gachaAgain, actions.primary, {
    y: -112,
    x: -134,
    width: 252,
    height: 76,
    color: COLORS.clay,
    fontSize: 28,
  });
  addUIButton(card, 'GachaSecondary', COPY.gachaBack, actions.secondary, {
    y: -112,
    x: 134,
    width: 252,
    height: 76,
    color: COLORS.sage,
    fontSize: 28,
  });
  tween(fade).to(0.24, { opacity: 255 }).start();
  tween(holder).to(0.36, { position: new Vec3(0, CARD_Y, 0) }, { easing: 'backOut' }).start();
  return holder;
}
