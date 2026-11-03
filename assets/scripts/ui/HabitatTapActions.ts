// STATUS: implemented, W25 P0-B 小屋触点派发（原 HabitatMenu 的四键判定搬到这里；决策-4/6b 的文案口径不变）
// 交互改造只换"入口"：点立绘=抚摸、点属性图标=对应动作、长按立绘=高级粮；数值与置灰原因仍走同一套规则表。
import { EventTouch, Node, UITransform, Vec3, v3 } from 'cc';
import { PetQuota } from '../cache/PetQuota';
import { affordShortfall } from '../game/HabitatModel';
import { HabitatAction, HabitatStatKey, HABITAT_RULES } from '../game/HabitatRules';
import { Point } from './ParticleKit';

/** 列表要能上下拖，位移超过这个阈值算滚动而不是点选（沿用 HabitatRows 原口径）。 */
const TAP_SLOP = 24;
/** 长按判定门槛：拍板-3 保留显式小键，长按只是快捷方式，门槛不能太高否则误触。 */
const HOLD_MS = 350;
/** 触点落点缺省宽度：没有 UITransform 时按 44 热区折算。 */
const FALLBACK_WIDTH = 44;

/** 三条属性各自对应哪个动作——图标即按钮，玩家不必读文字。 */
export const STAT_ACTION: Record<HabitatStatKey, HabitatAction> = {
  hunger: 'feed',
  cleanliness: 'bath',
  mood: 'pet',
};

/** 短按回调：入参是触点在该热区里的左右偏移（-1..1），供 Q 弹判断形变方向。 */
export type ZoneHandler = (touchX: number) => void;

/** 短按触点：拖动超过阈值不触发，交给 ScrollView 处理。 */
export function bindTapZone(node: Node, onFire: ZoneHandler): void {
  let startX = 0;
  let startY = 0;
  let lean = 0;
  node.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
    const p = event.getUILocation();
    startX = p.x;
    startY = p.y;
    lean = normalizedX(node, p.x);
  });
  node.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
    const p = event.getUILocation();
    if (Math.abs(p.x - startX) + Math.abs(p.y - startY) < TAP_SLOP) {
      onFire(lean);
    }
  });
}

/**
 * 同一触点两种语义：短按摸一下，长按喂高级粮；抬手前超时即算长按，之后不再补发短按。
 * 长按触发前要看位移：立绘占了半张卡片，从它上面起手的拖动很常见，位移超阈值就整个放弃判定。
 */
export function bindTapOrHold(node: Node, onShort: ZoneHandler, onLong: () => void): void {
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let lean = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let held = false;
  const moved = (): boolean => Math.abs(lastX - startX) + Math.abs(lastY - startY) >= TAP_SLOP;
  node.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
    const p = event.getUILocation();
    startX = p.x;
    startY = p.y;
    lastX = p.x;
    lastY = p.y;
    lean = normalizedX(node, p.x);
    held = false;
    timer = setTimeout(() => {
      timer = null;
      if (moved()) {
        return;
      }
      held = true;
      onLong();
    }, HOLD_MS);
  });
  node.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => {
    const p = event.getUILocation();
    lastX = p.x;
    lastY = p.y;
  });
  const cancel = (): void => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  node.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
    cancel();
    if (held) {
      return;
    }
    const p = event.getUILocation();
    if (Math.abs(p.x - startX) + Math.abs(p.y - startY) < TAP_SLOP) {
      onShort(lean);
    }
  });
  node.on(Node.EventType.TOUCH_CANCEL, cancel);
}

/**
 * 卡片里画的坐标是卡片局部坐标，反馈层（粒子、抛物线）挂在遮罩上，两者不同层。
 * 这里做一次世界坐标中转，触点侧就不必知道遮罩的层级。
 */
export function localToHost(node: Node, host: Node, local: Point): Point {
  const from = node.getComponent(UITransform);
  const to = host.getComponent(UITransform);
  if (!from || !to) {
    return { x: local.x, y: local.y };
  }
  const world: Vec3 = from.convertToWorldSpaceAR(v3(local.x, local.y, 0));
  const back = to.convertToNodeSpaceAR(world);
  return { x: back.x, y: back.y };
}

/** 买不起或次数用完时的说明：触点侧只负责变暗，具体原因仍由规则表给出。 */
export function shortfallText(action: HabitatAction): string | null {
  return affordShortfall(HABITAT_RULES[action]);
}

/**
 * 面板顶部引导行：弹窗删掉后手势必须写在脸上，否则玩家找不到互动入口。
 * 抚摸余量是**全局**计数（存档 pettedCount），所以这句提示只出现在面板上、不进每张小卡片。
 */
export function habitatHintText(): string {
  const remain = PetQuota.remaining(HABITAT_RULES.pet.dailyLimit);
  const quota = remain === null ? '' : `（今日剩 ${remain} 次）`;
  return `点图标喂食 / 洗澡 · 点立绘摸一摸${quota} · 长按立绘喂高级粮`;
}

/** 世界 X 折算成热区内的 -1..1：按 UITransform 宽度算，锚点非居中时结果只是略偏，不影响手感。 */
function normalizedX(node: Node, worldX: number): number {
  const width = node.getComponent(UITransform)?.contentSize.width ?? FALLBACK_WIDTH;
  const local = node.getComponent(UITransform)
    ? node.getComponent(UITransform)!.convertToNodeSpaceAR(v3(worldX, 0, 0)).x
    : 0;
  return Math.max(-1, Math.min(1, local / (width / 2)));
}
