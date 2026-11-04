// STATUS: implemented, W25 P2-D 剪指甲小游戏（红点就近命中；点错抖一下宠物并中断，不扣金币只占当日次数）
import { BlockInputEvents, Color, EventTouch, Node, UITransform, v3 } from 'cc';
import { CharacterConfig } from '../config/CharacterConfig';
import { GroomingConfig } from '../config/GroomingConfig';
import { CareOutcome, NailDot, dotIndexAt, nailDots } from '../game/CareRules';
import { failNailCare, finishNailCare } from '../game/NailCare';
import { PetVisual } from '../game/PetVisual';
import { makeLabel } from './FontKit';
import { makeNailDots, makeNailField, shakePet } from './NailField';
import { addCard } from './PanelKit';
import { addLabel, addRect } from './SceneUI';
import { fitWidth, screenHeight, screenWidth } from './ScreenMetrics';
import { addUIButton } from './UIButton';
import { COLORS, HEX, tint } from './Tokens';

/**
 * 点位与命中半径同步放大 1.9：grooming.json 的 hitRadius=46 在 720 帧里落到手机上只有 ~24pt，
 * 单独放大命中半径会让相邻两点互相抢点击，所以点位与半径必须同比例。
 */
const SCALE = 1.9;
const PANEL_H = 760;

let overlay: Node | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

export function closeNailGame(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (overlay) {
    overlay.destroy();
    overlay = null;
  }
}

export function openNailGame(parent: Node, petId: string, onDone: (outcome: CareOutcome) => void): void {
  closeNailGame();
  const look = CharacterConfig.petById(petId);
  const config = GroomingConfig.nail;
  const dots: NailDot[] = nailDots(Math.floor(Math.random() * 1e9), config.dots).map((dot) => ({
    x: dot.x * SCALE,
    y: dot.y * SCALE,
  }));
  const hit = dots.map(() => false);
  const radius = Math.max(1, config.hitRadius) * SCALE;

  overlay = addRect(parent, 'NailOverlay', 0, screenWidth(), screenHeight(), new Color(0, 0, 0, 130));
  overlay.addComponent(BlockInputEvents);
  overlay.setSiblingIndex(parent.children.length - 1);
  const panel = addCard(overlay, 'NailPanel', 0, fitWidth(1040, 30), PANEL_H, { color: tint(HEX.wall) });
  addLabel(panel, 'NailTitle', `给${look ? look.name : '小家伙'}剪指甲`, 330, { size: 32 });
  addLabel(panel, 'NailHint', `依次点掉 ${dots.length} 个红点，点错会吓到它`, 282, { size: 18, color: COLORS.sub });

  const field = makeNailField(panel, 20);
  const visual = PetVisual.mount(field, 300, true);
  visual.apply(petId);
  const dotsNode = makeNailDots(field, dots, hit);
  const progress = makeLabel(panel, 'NailProgress', `已剪 0/${dots.length}`, -210, { size: 22 });
  let finished = false;
  const stop = (outcome: CareOutcome): void => {
    if (finished) {
      return;
    }
    finished = true;
    timer = setTimeout(() => {
      timer = null;
      closeNailGame();
      onDone(outcome);
    }, 340);
  };

  field.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
    if (finished) {
      return;
    }
    const p = event.getUILocation();
    const local = field.getComponent(UITransform)!.convertToNodeSpaceAR(v3(p.x, p.y, 0));
    const index = dotIndexAt(dots, local.x, local.y, radius);
    if (index < 0) {
      shakePet(visual.node);
      stop(failNailCare(petId));
      return;
    }
    if (hit[index]) {
      return;
    }
    hit[index] = true;
    dotsNode.redraw();
    const cut = hit.filter((done) => done).length;
    if (progress.isValid) {
      progress.string = `已剪 ${cut}/${dots.length}`;
    }
    if (cut >= dots.length) {
      stop(finishNailCare(petId));
    }
  });

  addUIButton(panel, 'NailClose', '先不剪了', closeNailGame, {
    y: -320,
    width: 260,
    height: 64,
    color: COLORS.sage,
    fontSize: 26,
  });
  dotsNode.redraw();
}

