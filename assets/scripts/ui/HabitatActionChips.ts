// STATUS: implemented, W25 P2-D 卡片内【护理】/【送养】小键（与高级粮同列往下两行；列表可拖，热区走位移阈值）
import { Color, Graphics, Node, UIOpacity, UITransform } from 'cc';
import { pendingReview } from '../game/RehomeModel';
import { makeLabel } from './FontKit';
import { bindChipPress } from './HabitatChip';
import { bindTapZone } from './HabitatTapActions';
import { COLORS } from './Tokens';

const CHIP_W = 80;
const CHIP_H = 34;
/** 节点热区比视觉大一圈：手机上 80×34 的按钮直接当触点太窄。 */
const ZONE_W = 88;
const ZONE_H = 44;
const RADIUS = 11;
const STEP = 40;
/** 正在等审核的那只降一档：读得出「点不动」，但仍看得见它在等结果。 */
const PENDING_SELF_DIM = 170;
const PENDING_OTHER_DIM = 92;

interface ChipHandle {
  set(text: string, opacity: number): void;
}

export interface HabitatActionChips {
  sync(): void;
}

/** top 是【护理】中心；【送养】按 STEP 落在下一行。 */
export function addActionChips(
  parent: Node,
  petId: string,
  x: number,
  top: number,
  onCare: () => void,
  onRehome: () => void,
): HabitatActionChips {
  const care = buildChip(parent, `Care_${petId}`, '护理', x, top, COLORS.mist, onCare);
  const rehome = buildChip(parent, `Rehome_${petId}`, '送养', x, top - STEP, COLORS.clay, onRehome);
  const chips: HabitatActionChips = {
    sync(): void {
      const pending = pendingReview();
      care.set('护理', 255);
      if (!pending) {
        rehome.set('送养', 255);
        return;
      }
      rehome.set(
        pending.petId === petId ? '审核中' : '送养',
        pending.petId === petId ? PENDING_SELF_DIM : PENDING_OTHER_DIM,
      );
    },
  };
  chips.sync();
  return chips;
}

function buildChip(
  parent: Node,
  name: string,
  text: string,
  x: number,
  y: number,
  color: Color,
  onFire: () => void,
): ChipHandle {
  const node = new Node(`HabitatAction_${name}`);
  node.parent = parent;
  node.setPosition(x, y, 0);
  node.addComponent(UITransform).setContentSize(ZONE_W, ZONE_H);
  const graphics = node.addComponent(Graphics);
  graphics.fillColor = color;
  graphics.roundRect(-CHIP_W / 2, -CHIP_H / 2, CHIP_W, CHIP_H, RADIUS);
  graphics.fill();
  const label = makeLabel(node, `${name}Text`, text, 0, { size: 17, width: CHIP_W - 6, color: COLORS.white });
  const opacity = node.addComponent(UIOpacity);
  bindTapZone(node, () => onFire());
  bindChipPress(node);
  return {
    set(next: string, alpha: number): void {
      if (label.isValid) {
        label.string = next;
      }
      if (opacity.isValid) {
        opacity.opacity = alpha;
      }
    },
  };
}
