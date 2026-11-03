// STATUS: implemented, W23-1 小屋互动规则表（数值口径：方案 §2.2 + 2026-11-03 决策-4）
import type { AudioCue } from '../config/AudioConfig';

export type HabitatAction = 'feed' | 'premium' | 'bath' | 'pet';
export type HabitatStatKey = 'hunger' | 'cleanliness' | 'mood';

export interface HabitatRule {
  stat: HabitatStatKey;
  delta: number;
  costCoins: number;
  costHearts: number;
  cue: AudioCue;
  /**
   * 每日次数上限；0 表示不限。计数是**全局**的（存档 `pettedDay` / `pettedCount`，方案 §2.1），
   * 不是每只宠物各 3 次——替换掉原来的 60 秒冷却：文档要的是「每天几次零成本回访」，不是防连点。
   */
  dailyLimit: number;
  label: string;
  costText: string;
  fullText: string;
  /** 属性中文名，用于按实际收益拼飘字（老年心情收益会打折，不能写死文案）。 */
  statLabel: string;
}

/** §2.2 基准表：喂食/高级粮都加饱食度，高级粮用爱心换一次加满的大额收益。 */
export const HABITAT_RULES: Record<HabitatAction, HabitatRule> = {
  feed: {
    stat: 'hunger', delta: 30, costCoins: 30, costHearts: 0, cue: 'feed', dailyLimit: 0,
    label: '喂食', costText: '30 金币', fullText: '已经吃饱啦', statLabel: '饱食度',
  },
  premium: {
    // cue 复用 feed：同属「吃」，不新增云存储音频 key（方案 §2.4）。
    stat: 'hunger', delta: 70, costCoins: 0, costHearts: 8, cue: 'feed', dailyLimit: 0,
    label: '高级粮', costText: '8 爱心', fullText: '已经吃饱啦', statLabel: '饱食度',
  },
  bath: {
    stat: 'cleanliness', delta: 35, costCoins: 20, costHearts: 5, cue: 'bath', dailyLimit: 0,
    label: '洗澡', costText: '20 金币 + 5 爱心', fullText: '已经很干净啦', statLabel: '清洁度',
  },
  pet: {
    stat: 'mood', delta: 10, costCoins: 0, costHearts: 0, cue: 'pet', dailyLimit: 3,
    label: '抚摸', costText: '免费', fullText: '心情已经满格啦', statLabel: '心情',
  },
};

/** 菜单按这一行的顺序摆按钮：两档喂食并列，再洗澡、再抚摸。 */
export const HABITAT_ACTIONS: readonly HabitatAction[] = ['feed', 'premium', 'bath', 'pet'];
