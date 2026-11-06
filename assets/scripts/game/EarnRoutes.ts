// STATUS: implemented, W27 P3-UI 模块三 资源不足获取指引（纯函数：缺金币/爱心时该把玩家送到哪一格 TAB）
// 口径：只指向「点一下就能当场拿到」的免费产出，绝不把玩家支去广告或付费入口；
// 三条路径按到账速度排序——可领的成就 > 到点的送养感谢金 > 接诊病例主产出线。
import type { LobbyTab } from '../ui/LobbyTabs';

export type EarnKind = 'coins' | 'hearts';

export interface EarnSignals {
  /** 成就谱里已达成但还没领的档位数（领了就发金币和爱心）。 */
  claimable: number;
  /** 送养审核已到点、结果还没领的件数（只有金币感谢金，所以爱心路线不看它）。 */
  rehomeReady: number;
}

export interface EarnRoute {
  tab: LobbyTab;
  text: string;
}

const RESOURCE: Record<EarnKind, string> = { coins: '金币', hearts: '爱心' };

export function earnRoute(kind: EarnKind, signals: EarnSignals): EarnRoute {
  const name = RESOURCE[kind];
  const claimable = Math.max(0, Math.floor(signals.claimable));
  if (claimable > 0) {
    return { tab: 'achieve', text: `缺${name}？成就谱还有 ${claimable} 档没领，点了就到账` };
  }
  if (kind === 'coins' && Math.floor(signals.rehomeReady) > 0) {
    return { tab: 'habitat', text: `缺${name}？送养审核已到点，去小屋领感谢金` };
  }
  return { tab: 'clinic', text: `缺${name}？接诊病例结算就发，先去街头寻访一只` };
}
