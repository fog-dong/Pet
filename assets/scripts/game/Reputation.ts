// STATUS: implemented, W25 P2-A3 医院口碑（07 §5：治疗成功 +1~3、差评 −1 仅危重超时）
import { Save } from '../cache/Save';
import { PenaltyConfig } from '../config/PenaltyConfig';
import { Track } from '../track/Track';

export interface ReputationChange {
  /** 真正落账的变化量；口碑不足时扣减量会被收敛，可能与配置值不同。 */
  delta: number;
  after: number;
}

/**
 * 口碑是本地权威值，随 saveGame 快照写进 hospital_state.reputation（服务端白名单已收该字段）。
 * 服务端要求非负整数，所以扣减不能扣穿 0——否则会连整份快照一起被判 INVALID_PARAM。
 */
function apply(raw: number, reason: string): ReputationChange {
  const before = Save.snapshot().reputation;
  const wanted = Math.round(raw);
  if (wanted === 0) {
    return { delta: 0, after: before };
  }
  const delta = wanted < 0 ? -Math.min(before, -wanted) : wanted;
  Save.mutate((data) => {
    data.reputation = Math.max(0, before + delta);
  });
  const after = Save.snapshot().reputation;
  Track.track('reputation_change', { reason, delta, before, after });
  return { delta, after };
}

export const Reputation = {
  get value(): number {
    return Save.snapshot().reputation;
  },

  /** 治疗成功按本局星级折算（0 星不加分）；结算幂等由 CaseSession.settle() 的备忘录保证。 */
  awardCase(stars: number): ReputationChange {
    return apply(stars * PenaltyConfig.reputation.gainPerStar, 'case');
  },

  /** 危重超时即 07 §5 的「差评」，返回实际扣量供结算页公示。 */
  punishTransfer(): ReputationChange {
    return apply(-PenaltyConfig.reputation.transferPenalty, 'transfer');
  },
};
