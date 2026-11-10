// STATUS: implemented, W26 P2-E 大厅地板散步带：已领养宠物趴在 ui_cushion 上，立绘尺寸由底部栈剩余高度派生，点一只直接进小屋
// 谁上台：三项属性合计最差的两只。回大厅第一眼就看到「谁最需要照顾」，这是散步带的回访钩子，不是随机摆 pose。
import { Color, Graphics, Node, Tween, Vec3, tween } from 'cc';
import { HabitatPet } from '../cache/HabitatCodec';
import { petMoodState } from '../game/PetMood';
import { PetVisual } from '../game/PetVisual';
import { addDecor } from './Backdrop';
import { lobbyPetBandSize, lobbyPetBandY } from './LobbyDockLayout';
import { playStaggerIn, settleEntrance, squash } from './MotionKit';
import { PALETTE, addLabel, createNode } from './SceneUI';
import { DURATION } from './Tokens';

/** 720 帧扣掉左右各 20 留白只剩 680。 */
const BAND_VIEW_W = 680;
/**
 * 散步带的高度现在由底部栈剩余空间派生（120–180），垫子与间距只能跟着立绘尺寸走：
 * 垫子比立绘宽 4%、两只的圆心距同样 4% 呼吸，才不会在矮档下互相粘连。
 */
const CUSHION_RATIO = 1.04;
/** 立绘脚底在节点原点下方 0.3633 个 size（见 LobbyDockLayout 的 ART_FOOT_RATIO），垫子压在那条线上。 */
const CUSHION_FOOT_RATIO = 0.3633;
const CUSHION_DROP = 4;
const MAX_VISIBLE = 2;
const EMPTY_TEXT = '救回第一只小家伙后，它会在这里等你';

export interface PetBandHandle {
  refresh(entries: readonly HabitatPet[]): void;
}

export function mountLobbyPetRow(parent: Node, onPick: (petId: string) => void): PetBandHandle {
  const size = lobbyPetBandSize();
  const band = createNode(parent, 'LobbyPetBand', lobbyPetBandY(), BAND_VIEW_W, size);
  let key = '';
  let built = false;
  return {
    refresh(entries: readonly HabitatPet[]): void {
      const picked = bandPets(entries);
      // 小屋每做一次互动都会回调刷资源；台上人和状态没变就别重建，否则每点一下都在重播入场。
      const next = picked.map((entry) => `${entry.petId}:${petMoodState(entry)}`).join('|');
      if (built && next === key) {
        return;
      }
      built = true;
      key = next;
      rebuild(band, picked, size, onPick);
    },
  };
}

function rebuild(
  band: Node,
  picked: readonly HabitatPet[],
  size: number,
  onPick: (petId: string) => void,
): void {
  band.destroyAllChildren();
  if (picked.length === 0) {
    addEmptyPlaque(band);
    return;
  }
  const nodes: Node[] = [];
  picked.forEach((entry, index) => nodes.push(addPet(band, index, picked.length, entry, size, onPick)));
  // 散步带是「回到大厅」的门面：入场比面板长一档，用 backOut 让脚落地时带一点过冲。
  playStaggerIn(nodes, { duration: DURATION.bandIn, easing: 'backOut' });
}

/** 空带文字直接压在柜台木板上太生硬：垫一块奶油色圆角牌，读成前台摆的小立牌。 */
function addEmptyPlaque(band: Node): void {
  const plate = createNode(band, 'LobbyPetBandEmptyPlate', 0, 560, 68);
  const graphics = plate.addComponent(Graphics);
  graphics.fillColor = new Color(255, 250, 240, 236);
  graphics.roundRect(-280, -34, 560, 68, 34);
  graphics.fill();
  addLabel(band, 'LobbyPetBandEmpty', EMPTY_TEXT, 0, {
    size: 22,
    color: PALETTE.sub,
    width: BAND_VIEW_W,
  });
}

function addPet(
  band: Node,
  index: number,
  count: number,
  entry: HabitatPet,
  size: number,
  onPick: (petId: string) => void,
): Node {
  const cushionW = size * CUSHION_RATIO;
  const x = (index - (count - 1) / 2) * cushionW;
  addDecor(band, 'ui_cushion', -CUSHION_FOOT_RATIO * size - CUSHION_DROP, cushionW, x);
  const visual = PetVisual.mount(band, size);
  visual.node.name = `LobbyPet_${entry.petId}`;
  visual.node.setPosition(x, 0, 0);
  visual.apply(entry.petId);
  // 散步带是「回来一眼看到它」的门面，只在这两只身上插入习性动作，图鉴等批量立绘保持安静。
  visual.playState(petMoodState(entry), true);
  bindPick(visual.node, () => onPick(entry.petId));
  return visual.node;
}

function bandPets(entries: readonly HabitatPet[]): HabitatPet[] {
  return [...entries]
    .sort((a, b) => a.hunger + a.cleanliness + a.mood - (b.hunger + b.cleanliness + b.mood))
    .slice(0, MAX_VISIBLE);
}

/** 按下压一档、松手先回弹再演 Q 弹，然后才开面板：手感在前，面板在后。 */
function bindPick(node: Node, onPick: () => void): void {
  node.on(Node.EventType.TOUCH_START, () => {
    Tween.stopAllByTarget(node);
    settleEntrance(node);
    tween(node).to(DURATION.press, { scale: new Vec3(0.94, 0.94, 1) }).start();
  });
  const restore = (): void => {
    Tween.stopAllByTarget(node);
    node.setScale(1, 1, 1);
  };
  node.on(Node.EventType.TOUCH_CANCEL, restore);
  node.on(Node.EventType.TOUCH_END, () => {
    restore();
    squash(node);
    onPick();
  });
}
