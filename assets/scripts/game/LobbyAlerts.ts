// STATUS: implemented, W27 P3-UI 模块三 大厅红点信号源（纯函数，可在 Node 下直接回归，不碰 cc 与存档）
// 口径：红点只表示「有一件事等你去收，收了就会灭」，不表示「宠物状态不好」——后者是常驻读数，
// 天天亮只会训练玩家无视它。诊疗 TAB 没有累积待收对象（病例点了就走），因此刻意不亮，不做假红点。
import type { LobbyTab } from '../ui/LobbyTabs';

/** 小屋照护线：与坞内「待照顾」同一档，低于这条线才叫要照顾。 */
export const NEED_CARE = 30;

export interface AlertSignals {
  /** 成就：可领但未领的档位数。 */
  claimable: number;
  /** 后院：已成熟待收的地块数。 */
  gardenReady: number;
  /** 送养：审核已到点、结果还没领的件数（同一时间最多一只，因此只可能是 0 或 1）。 */
  rehomeReady: number;
}

export type LobbyAlerts = Record<LobbyTab, number>;

/** 三个可亮的 TAB 各自等收什么，一览无余；不亮的档位一律写死 0，别在 UI 侧再判一次。 */
export function lobbyAlerts(signals: AlertSignals): LobbyAlerts {
  return {
    clinic: 0,
    garden: Math.max(0, signals.gardenReady),
    habitat: Math.max(0, signals.rehomeReady),
    achieve: Math.max(0, signals.claimable),
  };
}

/** 待收判据与 GardenRules.isReady 一致：有作物、readyAt 已被墙钟越过；空地不计。 */
export function countGardenReady(
  plots: readonly { cropId: string; readyAt: number }[],
  now: number,
): number {
  return plots.filter((plot) => plot.cropId !== '' && plot.readyAt > 0 && plot.readyAt <= now).length;
}

/** 审核件到点才算待收；没提交过送养（review 为空）永远不计。 */
export function countRehomeReady(review: { readyAt: number } | null, now: number): number {
  return review !== null && review.readyAt <= now ? 1 : 0;
}
