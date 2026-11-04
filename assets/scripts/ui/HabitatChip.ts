// STATUS: implemented, W25 P0-B 卡片内「高级粮」小键（拍板-3：删掉弹窗菜单后仍保留一枚显式入口，长按立绘只是快捷方式）
// 不是 cc.Button：列表要能上下拖，热区统一走 HabitatTapActions 的位移阈值，避免拖动误触发。
import { Graphics, Node, UIOpacity, UITransform, Vec3, tween } from 'cc';
import { HABITAT_RULES } from '../game/HabitatRules';
import { ZONE_DIM } from './HabitatBars';
import { makeLabel } from './FontKit';
import { TINT } from './HabitatFeedback';
import { bindTapZone, shortfallText } from './HabitatTapActions';
import { COLORS, DURATION } from './Tokens';

const CHIP_W = 88;
const CHIP_H = 46;
const RADIUS = 12;

export interface PremiumChip {
  node: Node;
  sync(): void;
}

/** 一枚小键只做一件事：按下去喂高级粮；余量与失败原因由互动层给 Toast。 */
export function addPremiumChip(
  parent: Node,
  petId: string,
  x: number,
  y: number,
  onFire: (touchX: number) => void,
): PremiumChip {
  const rule = HABITAT_RULES.premium;
  const node = new Node(`HabitatChip_${petId}`);
  node.parent = parent;
  node.setPosition(x, y, 0);
  node.addComponent(UITransform).setContentSize(CHIP_W, CHIP_H);
  const graphics = node.addComponent(Graphics);
  graphics.fillColor = TINT.premium;
  graphics.roundRect(-CHIP_W / 2, -CHIP_H / 2, CHIP_W, CHIP_H, RADIUS);
  graphics.fill();
  makeLabel(node, 'HabitatChipTitle', rule.label, 9, { size: 18, width: CHIP_W - 8, color: COLORS.white });
  makeLabel(node, 'HabitatChipCost', rule.costText, -12, { size: 14, width: CHIP_W - 8, color: COLORS.white });
  node.addComponent(UIOpacity);
  bindTapZone(node, onFire);
  bindChipPress(node);
  const chip: PremiumChip = {
    node,
    sync(): void {
      const opacity = node.getComponent(UIOpacity);
      if (opacity) {
        // 与属性圆钮同一档：变暗而不是消失，玩家看得见"这一档现在买不起"。
        opacity.opacity = shortfallText('premium') ? ZONE_DIM : 255;
      }
    },
  };
  chip.sync();
  return chip;
}

/** 按下缩、抬手 backOut 回弹，与 UIButton 同一套 Playful 按压语言；护理/送养小键复用。 */
export function bindChipPress(node: Node): void {
  node.on(Node.EventType.TOUCH_START, () => {
    tween(node).to(DURATION.press, { scale: new Vec3(0.94, 0.94, 1) }).start();
  });
  const release = (): void => {
    if (!node.isValid) {
      return;
    }
    tween(node).to(DURATION.release, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
  };
  node.on(Node.EventType.TOUCH_END, release);
  node.on(Node.EventType.TOUCH_CANCEL, release);
}
