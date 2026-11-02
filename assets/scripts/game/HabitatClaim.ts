// STATUS: implemented, W20-3/模块一 小屋离线收益领取（数额只取服务端返回，客户端不自行计价）
// API: claimHabitat, see docs/plan/接口冻结清单.md §2.12
import { Save } from '../cache/Save';
import { COPY, fillCopy } from '../config/CopyText';
import { Net } from '../net/Net';
import { Track } from '../track/Track';

/** 与云函数 index.ts 的错误码一一对应：1003 是当日额度用尽。 */
const CODE_RATE_LIMITED = 1003;

interface ClaimHabitatData {
  hours: number;
  coins: number;
}

export type ClaimOutcome =
  | { kind: 'granted'; hours: number; coins: number; text: string }
  | { kind: 'resting'; text: string }
  | { kind: 'unavailable'; text: string }
  | { kind: 'busy' };

/** 连点保护：同一时刻只允许一次在途请求，第二次直接吞掉，不弹误导文案。 */
let inflight = false;

export async function claimOfflineEarnings(): Promise<ClaimOutcome> {
  if (inflight) {
    return { kind: 'busy' };
  }
  // Net.ready 为 false 说明云环境没配或 login 没跑通：按断网处理，本地一分不发。
  if (!Net.ready) {
    Track.track('habitat_claim_skipped', { reason: 'net_not_ready' });
    return { kind: 'unavailable', text: COPY.habitatClaimOffline };
  }
  inflight = true;
  try {
    return await runClaim();
  } finally {
    inflight = false;
  }
}

async function runClaim(): Promise<ClaimOutcome> {
  const response = await Net.call<ClaimHabitatData>('claimHabitat', {
    lastClaimTime: Save.snapshot().habitatLastClaimAt,
  });
  if (response.code === CODE_RATE_LIMITED) {
    Track.track('habitat_claim_limited');
    return { kind: 'resting', text: COPY.habitatResting };
  }
  if (response.code !== 0 || !response.data) {
    Track.track('habitat_claim_failed', { code: response.code });
    return { kind: 'unavailable', text: COPY.habitatClaimFailed };
  }
  const hours = toCount(response.data.hours);
  const coins = toCount(response.data.coins);
  // 一次落盘同时做两件事：推进本地起算点（跟服务端时钟，连点也推进，免得重复计时）
  // 和把服务端事务算出的金币镜像进本地存档（G4 口径：数额来自服务端，客户端不自行计价）。
  const claimedAt = typeof response.serverTime === 'number' && response.serverTime > 0
    ? response.serverTime
    : Date.now();
  Save.mutate((data) => {
    data.habitatLastClaimAt = claimedAt;
    if (coins > 0) {
      data.coins = Math.max(0, data.coins + coins);
    }
  });
  if (coins <= 0) {
    Track.track('habitat_claim_empty', { hours });
    return { kind: 'resting', text: COPY.habitatResting };
  }
  Track.track('habitat_claim_granted', { hours, coins });
  return {
    kind: 'granted',
    hours,
    coins,
    text: fillCopy(COPY.habitatClaimed, { hours, coins }),
  };
}

function toCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}
