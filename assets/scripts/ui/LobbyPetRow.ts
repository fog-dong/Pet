// STATUS: implemented, W25 P0-C 大厅地板散步带：已领养宠物趴在 ui_cushion 上，立绘 240（屏宽 1/3），点一只直接进小屋
// 谁上台：三项属性合计最差的两只。回大厅第一眼就看到「谁最需要照顾」，这是散步带的回访钩子，不是随机摆 pose。
import { Color, Graphics, Node, Tween, Vec3, tween } from 'cc';
import { HabitatPet } from '../cache/HabitatCodec';
import type { PetState } from '../game/CharacterLook';
import { PetVisual } from '../game/PetVisual';
import { addDecor } from './Backdrop';
import { lobbyPetBandY, PET_BAND_SIZE } from './LobbyLayout';
import { playStaggerIn, settleEntrance, squash } from './MotionKit';
import { PALETTE, addLabel, createNode } from './SceneUI';
import { DURATION } from './Tokens';

/** 720 帧扣掉左右各 20 留白只剩 680，240 见方按 250 间距最多放两只整只。 */
const BAND_VIEW_W = 680;
const PITCH = 250;
const MAX_VISIBLE = 2;
/** 垫子比立绘宽一点、压在脚下：立绘的透明边 + 垫子的圆角，两只贴在一起也不粘连。 */
const CUSHION_W = 250;
const CUSHION_Y = -92;
const WORST_STAT_SLEEP = 30;
const HAPPY_MOOD = 70;
const EMPTY_TEXT = '救回第一只小家伙后，它会在这里等你';

export interface PetBandHandle {
  refresh(entries: readonly HabitatPet[]): void;
}

export function mountLobbyPetRow(parent: Node, onPick: (petId: string) => void): PetBandHandle {
  const band = createNode(parent, 'LobbyPetBand', lobbyPetBandY(), BAND_VIEW_W, PET_BAND_SIZE);
  let key = '';
  let built = false;
  return {
    refresh(entries: readonly HabitatPet[]): void {
      const picked = bandPets(entries);
      // 小屋每做一次互动都会回调刷资源；台上人和状态没变就别重建，否则每点一下都在重播入场。
      const next = picked.map((entry) => `${entry.petId}:${bandState(entry)}`).join('|');
      if (built && next === key) {
        return;
      }
      built = true;
      key = next;
      rebuild(band, picked, onPick);
    },
  };
}

function rebuild(band: Node, picked: readonly HabitatPet[], onPick: (petId: string) => void): void {
  band.destroyAllChildren();
  if (picked.length === 0) {
    addEmptyPlaque(band);
    return;
  }
  const nodes: Node[] = [];
  picked.forEach((entry, index) => nodes.push(addPet(band, index, picked.length, entry, onPick)));
  playStaggerIn(nodes);
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
  onPick: (petId: string) => void,
): Node {
  const x = (index - (count - 1) / 2) * PITCH;
  addDecor(band, 'ui_cushion', CUSHION_Y, CUSHION_W, x);
  const visual = PetVisual.mount(band, PET_BAND_SIZE);
  visual.node.name = `LobbyPet_${entry.petId}`;
  visual.node.setPosition(x, 0, 0);
  visual.apply(entry.petId);
  visual.playState(bandState(entry));
  bindPick(visual.node, () => onPick(entry.petId));
  return visual.node;
}

function bandPets(entries: readonly HabitatPet[]): HabitatPet[] {
  return [...entries]
    .sort((a, b) => a.hunger + a.cleanliness + a.mood - (b.hunger + b.cleanliness + b.mood))
    .slice(0, MAX_VISIBLE);
}

/** 档位沿用行为状态机现有的三档，不为大厅新造一档。 */
function bandState(entry: HabitatPet): PetState {
  const worst = Math.min(entry.hunger, entry.cleanliness, entry.mood);
  if (worst < WORST_STAT_SLEEP) {
    return 'sleep';
  }
  return entry.mood >= HAPPY_MOOD ? 'happy' : 'idle';
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
