// STATUS: implemented, W30-1 猫狗习性动作（走动 / 伸懒腰 / 舔爪）：idle 档在呼吸之间插一段主动作
// 幅度守 W17-3 口径：位移 ≤9px、旋转 ≤4°、缩放 ≤1.05；低画质整段不跑，静态姿态仍由 PetBehavior 落。
import { Node, Tween, Vec3, tween } from 'cc';
import { DURATION } from '../ui/Tokens';
import { HabitAction, pickNextHabit } from './PetHabitPlan';

export interface IdleLife {
  stop(): void;
}

export interface IdleOptions {
  /** 首轮延迟：同屏两只错开，避免一起伸懒腰。 */
  delay?: number;
  /** 抽签源，默认 Math.random；回归脚本注入固定序列。 */
  rand?: () => number;
}

const ONE = new Vec3(1, 1, 1);
/** 走动单程 9px：再远就贴上相邻卡片的立绘了。 */
const WALK_STEP = 9;
const WALK_TILT = 3;
const LICK_TILT = -4;

/** 一个立绘只该有一条 idle 生活线：句柄挂在 content 上，宿主换档时按节点停，不必自己存引用。 */
const lives = new WeakMap<Node, IdleLife>();

/**
 * 呼吸常驻，每隔 habitGap 停一次呼吸演一个习性动作。
 * 定时器独立于 tween：外部 squash 打断动作链时下一轮照样能接上，不会永久停在静态。
 */
export function startIdleLife(content: Node, options: IdleOptions = {}): void {
  stopIdleLife(content);
  const rand = options.rand ?? Math.random;
  const home = content.position.clone();
  const gap = (): number => DURATION.habitGap * (0.7 + rand() * 0.8);
  let last: HabitAction | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const settle = (): void => {
    // 面板关闭时子树先于组件销毁，此刻写已销毁节点会抛空指针
    if (!content.isValid) return;
    content.setScale(ONE);
    content.angle = 0;
    content.setPosition(home.x, home.y, home.z);
  };

  const breathe = (): void => {
    Tween.stopAllByTarget(content);
    settle();
    tween(content)
      .to(DURATION.habitBreath, { scale: new Vec3(1.03, 1.03, 1) })
      .to(DURATION.habitBreath, { scale: ONE })
      .union()
      .repeatForever()
      .start();
  };

  const cycle = (): void => {
    if (stopped) {
      return;
    }
    last = pickNextHabit(rand(), last);
    playHabit(content, home, last, breathe);
    timer = setTimeout(cycle, gap() * 1000);
  };

  lives.set(content, {
    stop(): void {
      stopped = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      Tween.stopAllByTarget(content);
      settle();
    },
  });
  breathe();
  timer = setTimeout(cycle, (options.delay ?? gap()) * 1000);
}

export function stopIdleLife(content: Node): void {
  const life = lives.get(content);
  if (!life) {
    return;
  }
  lives.delete(content);
  life.stop();
}

/** 每个动作都从 home 起演、以归位收尾：in/out 都停在同一姿态，打断与否都不会留下歪脖子。 */
function playHabit(content: Node, home: Vec3, action: HabitAction, done: () => void): void {
  Tween.stopAllByTarget(content);
  content.setScale(ONE);
  content.angle = 0;
  content.setPosition(home.x, home.y, home.z);
  const chain = tween(content);
  if (action === 'walk') {
    // 左右各半步再回来：净位移为零，读起来像在原地踱步而不是被推走。
    chain
      .by(DURATION.habitStep, { position: new Vec3(WALK_STEP, 0, 0), angle: WALK_TILT }, { easing: 'sineInOut' })
      .by(DURATION.habitStep, { position: new Vec3(-WALK_STEP * 2, 0, 0), angle: -WALK_TILT }, { easing: 'sineInOut' })
      .by(DURATION.habitStep, { position: new Vec3(WALK_STEP, 0, 0), angle: 0 }, { easing: 'sineInOut' });
  } else if (action === 'stretch') {
    // 前压拉长 → 后仰过头 → backOut 收住，是猫伸懒腰最省帧的三段。
    chain
      .to(DURATION.habitStretch * 0.6, { scale: new Vec3(1.05, 0.9, 1), angle: -2 }, { easing: 'quadOut' })
      .to(DURATION.habitStretch * 0.5, { scale: new Vec3(0.96, 1.05, 1), angle: 2 }, { easing: 'quadOut' })
      .to(DURATION.habitStretch, { scale: ONE, angle: 0 }, { easing: 'backOut' });
  } else {
    // 舔爪：低头歪向一侧，两下短促起伏，再抬回来。
    chain
      .to(DURATION.habitLick, { angle: LICK_TILT, scale: new Vec3(1.02, 0.97, 1) }, { easing: 'quadOut' })
      .to(DURATION.habitLick, { angle: LICK_TILT + 1, scale: new Vec3(1.03, 0.96, 1) }, { easing: 'sineInOut' })
      .to(DURATION.habitLick, { angle: LICK_TILT, scale: new Vec3(1.02, 0.97, 1) }, { easing: 'sineInOut' })
      .to(DURATION.habitLick, { angle: 0, scale: ONE }, { easing: 'backOut' });
  }
  chain.call(done).start();
}
