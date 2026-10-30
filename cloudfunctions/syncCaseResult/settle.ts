// STATUS: implemented, W12-3 事务式幂等结算（pets_cases 首写 + users.resources 只加一次）
import * as cloud from 'wx-server-sdk';
import { computeCase, rewardAmounts } from './formula';
import { isPlain, toCount } from './guard';
import type { CaseRewards, CaseResultSummary, SettleInput, SettleOutcome } from './types';

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database({ throwOnNotFound: false });

/** SDK 仅在事务冲突时自动重试，默认 3 次；命中上限后由 index.ts 映射成 1006。 */
const TRANSACTION_RETRIES = 3;

interface CaseDoc {
  caseSessionId?: string;
  openid?: string;
  caseId?: string;
  status?: string;
  result?: CaseResultSummary;
  rewards?: CaseRewards;
}

interface UserDoc {
  resources?: Record<string, unknown>;
  flags?: Record<string, unknown>;
}

function resourceView(user: UserDoc): Record<string, unknown> {
  return isPlain(user.resources) ? user.resources : {};
}

/**
 * 幂等键 `openid + caseSessionId` 落成 `pets_cases._id = openid:caseSessionId`：
 * 同一单局重放命中已存在文档直接回放历史结果；首次结算在同一个事务里写单局记录并给
 * `users.resources` 入账，两个并发首写会在 users 文档上产生事务冲突，重试后走回放分支。
 * 首通倍率用 `users.flags.caseStars`（病例历史最高星）判定，同样在事务内读改写。
 */
export async function settleCaseResult(input: SettleInput): Promise<SettleOutcome | null> {
  return db.runTransaction<SettleOutcome | null>(async (transaction) => {
    const userRef = transaction.collection<UserDoc>('users').doc(input.openid);
    const user = (await userRef.get()).data;
    if (!user) {
      return null;
    }

    const caseRef = transaction.collection<CaseDoc>('pets_cases').doc(`${input.openid}:${input.caseSessionId}`);
    const existing = (await caseRef.get()).data;
    if (existing && existing.result && existing.rewards) {
      return { replayed: true, result: existing.result, rewards: existing.rewards, resources: resourceView(user) };
    }

    const computed = computeCase(input.item, input.diagnosis, input.treatment);
    const flags = isPlain(user.flags) ? { ...user.flags } : {};
    const caseStars = isPlain(flags.caseStars) ? { ...flags.caseStars } : {};
    const previousStars = toCount(caseStars[input.caseId]);
    const firstClear = previousStars === 0 && computed.stars > 0;
    const amounts = rewardAmounts(input.item.baseRewards, computed.stars, firstClear);
    const resources = {
      ...resourceView(user),
      coins: toCount(user.resources?.coins) + amounts.coins,
      hearts: toCount(user.resources?.hearts) + amounts.hearts,
      updatedAt: input.now,
    };
    const result: CaseResultSummary = {
      caseId: input.caseId,
      status: computed.status,
      stars: computed.stars,
      diagnosisStars: computed.diagnosisStars,
      treatmentStars: computed.treatmentStars,
      recoveryStars: computed.recoveryStars,
      firstClear,
      durationMs: input.durationMs,
      finishedAt: input.now,
    };
    const rewards: CaseRewards = {
      coins: amounts.coins,
      hearts: amounts.hearts,
      reputation: 0,
      affection: computed.affection,
    };

    await caseRef.set({
      data: {
        caseSessionId: input.caseSessionId,
        openid: input.openid,
        caseId: input.caseId,
        petSpecies: input.item.petSpecies ?? '',
        petName: input.item.petName ?? '',
        severity: input.item.severity ?? 'normal',
        diagnosis: { ...input.diagnosis },
        treatment: { ...input.treatment },
        affection: computed.affection,
        status: computed.status,
        result,
        rewards,
        createdAt: input.now,
        finishedAt: input.now,
      },
    });
    await userRef.update({
      data: {
        resources,
        flags: { ...flags, caseStars: { ...caseStars, [input.caseId]: Math.max(previousStars, computed.stars) } },
      },
    });
    return { replayed: false, result, rewards, resources };
  }, TRANSACTION_RETRIES);
}
