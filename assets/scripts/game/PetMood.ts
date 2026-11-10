// STATUS: implemented, W30-1 属性 → 行为档位（大厅散步带与小屋卡片共用，阈值只此一份）
import type { PetState } from './CharacterLook';

export interface PetMoodStats {
  hunger: number;
  cleanliness: number;
  mood: number;
}

/** 三项最差低于 30 读作「睡着了」，情绪 ≥70 读作「开心」，其余安静站着。 */
const WORST_STAT_SLEEP = 30;
const HAPPY_MOOD = 70;

export function petMoodState(stats: PetMoodStats): PetState {
  const worst = Math.min(stats.hunger, stats.cleanliness, stats.mood);
  if (worst < WORST_STAT_SLEEP) {
    return 'sleep';
  }
  return stats.mood >= HAPPY_MOOD ? 'happy' : 'idle';
}
