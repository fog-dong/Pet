// STATUS: implemented, W30-1 习性动作抽签与属性档位纯函数回归（三动作全覆盖 / 越界收口 / 不连续重复 / 阈值边界）
// 用法：node --experimental-strip-types --no-warnings --import ./scripts/ts-resolve.mjs scripts/verify-pet-habits.js
import { HABIT_PLAN, pickHabit, pickNextHabit } from '../assets/scripts/game/PetHabitPlan.ts';
import { petMoodState } from '../assets/scripts/game/PetMood.ts';

let failures = 0;

function check(title, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures += 1;
  }
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${title} → ${JSON.stringify(actual)}${ok ? '' : ' 期望 ' + JSON.stringify(expected)}`);
}

// 一、三档都要抽得到：抽签源只取 0–0.9 时不能漏掉任何一只猫狗会做的动作。
const seen = new Set();
for (let i = 0; i < 200; i += 1) {
  seen.add(pickHabit(i / 200));
}
check('覆盖 三种动作齐全', [...seen].sort(), ['lick', 'stretch', 'walk']);
check('覆盖 计划表也是三档', [...new Set(HABIT_PLAN)].sort(), ['lick', 'stretch', 'walk']);

// 二、越界收口：负值 / 1 / NaN 都不能抽出 undefined 让 tween 演空动作。
check('边界 负值落第一档', pickHabit(-1), HABIT_PLAN[0]);
check('边界 1 落最后一档', pickHabit(1), HABIT_PLAN[HABIT_PLAN.length - 1]);
check('边界 NaN 落第一档', pickHabit(Number.NaN), HABIT_PLAN[0]);

// 三、不连续重复：任意 last 下顺延一档，都不等于上一轮，否则读成卡帧。
const actions = ['walk', 'stretch', 'lick'];
let repeats = 0;
for (const last of [null, ...actions]) {
  for (let i = 0; i < 200; i += 1) {
    if (pickNextHabit(i / 200, last) === last) {
      repeats += 1;
    }
  }
}
check('不重复 全程无连续同动作', repeats, 0);

// 四、属性档位：最差项决定睡姿，情绪 ≥70 才欢跳，30 / 70 这两个边界不许错位。
check('档位 全 0 睡', petMoodState({ hunger: 0, cleanliness: 100, mood: 100 }), 'sleep');
check('档位 最差 29 睡', petMoodState({ hunger: 29, cleanliness: 29, mood: 100 }), 'sleep');
check('档位 最差 30 不睡', petMoodState({ hunger: 30, cleanliness: 30, mood: 69 }), 'idle');
check('档位 情绪 70 欢跳', petMoodState({ hunger: 80, cleanliness: 80, mood: 70 }), 'happy');
check('档位 情绪 69 站立', petMoodState({ hunger: 80, cleanliness: 80, mood: 69 }), 'idle');

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
