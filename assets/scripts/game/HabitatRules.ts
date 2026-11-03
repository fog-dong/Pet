// STATUS: implemented, W22-4 小屋互动规则表（自 game/HabitatModel.ts 拆出，保持单文件 ≤150 行）
import type { AudioCue } from '../config/AudioConfig';

export type HabitatAction = 'feed' | 'bath' | 'pet';
export type HabitatStatKey = 'hunger' | 'cleanliness' | 'mood';

export interface HabitatRule {
  stat: HabitatStatKey;
  delta: number;
  costCoins: number;
  costHearts: number;
  cue: AudioCue;
  /** 冷却毫秒：只有免费动作需要，否则能连点把属性刷满。 */
  cooldownMs: number;
  label: string;
  costText: string;
  fullText: string;
  /** 属性中文名，用于按实际收益拼飘字（老年心情收益会打折，不能写死文案）。 */
  statLabel: string;
}

export const HABITAT_RULES: Record<HabitatAction, HabitatRule> = {
  feed: {
    stat: 'hunger', delta: 30, costCoins: 10, costHearts: 0, cue: 'feed', cooldownMs: 0,
    label: '喂食', costText: '10 金币', fullText: '已经吃饱啦', statLabel: '饱食度',
  },
  bath: {
    stat: 'cleanliness', delta: 40, costCoins: 0, costHearts: 5, cue: 'bath', cooldownMs: 0,
    label: '洗澡', costText: '5 爱心', fullText: '已经很干净啦', statLabel: '清洁度',
  },
  pet: {
    stat: 'mood', delta: 15, costCoins: 0, costHearts: 0, cue: 'pet', cooldownMs: 60 * 1000,
    label: '抚摸', costText: '免费', fullText: '心情已经满格啦', statLabel: '心情',
  },
};

export const HABITAT_ACTIONS: readonly HabitatAction[] = ['feed', 'bath', 'pet'];
