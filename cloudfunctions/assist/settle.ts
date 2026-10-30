// STATUS: implemented, W11-1 assist 落库与频控（同一事务内完成主键去重 + assist_daily 计数 + 超限判定）
// API: settleAssist, see docs/plan/集合与索引冻结.md §3.5 / §3.6
import * as cloud from 'wx-server-sdk';

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database({ throwOnNotFound: false });

/** `assist_pairs` 行，字段口径见《集合与索引冻结》§3.5。 */
export interface AssistPairDoc {
  pairId?: string;
  targetId?: string;
  helperId?: string;
  date?: string;
  resourceType?: string;
  nonce?: string;
  createdAt?: number;
}

interface AssistDailyRow {
  targetId?: string;
  date?: string;
  count?: number;
  createdAt?: number;
  updatedAt?: number;
}

export type AssistReason = 'ALREADY_ASSISTED' | 'LIMIT';

export interface AssistOutcome {
  granted: boolean;
  reason: AssistReason | null;
  dailyCount: number;
}

export interface SettleInput {
  pairId: string;
  dailyId: string;
  targetId: string;
  helperId: string;
  date: string;
  resourceType: string;
  nonce: string;
  limit: number;
  now: number;
}

/**
 * 去重、占额度、写记录压成一个原子读改写：
 * 改造前是「插 pair → inc 计数 → 读回 → 超限删 pair 并回退计数」，
 * 12 路并发时全部 `inc` 成功又读到同一个 burst 后的值，会把整批助力判成超限再整批回退。
 * 现在先判额度再写，超限路径不落任何文档，因此不需要补偿写。
 */
export async function settleAssist(input: SettleInput): Promise<AssistOutcome> {
  return db.runTransaction<AssistOutcome>(async (transaction) => {
    const pairRef = transaction.collection<AssistPairDoc>('assist_pairs').doc(input.pairId);
    const existing = await pairRef.get();
    const counterRef = transaction.collection<AssistDailyRow>('assist_daily').doc(input.dailyId);
    const current = await counterRef.get();
    const count = current.data && typeof current.data.count === 'number' ? current.data.count : 0;

    if (existing.data) {
      return { granted: false, reason: 'ALREADY_ASSISTED', dailyCount: count };
    }
    if (count >= input.limit) {
      return { granted: false, reason: 'LIMIT', dailyCount: count };
    }

    const dailyCount = count + 1;
    await counterRef.set({
      data: {
        targetId: input.targetId,
        date: input.date,
        count: dailyCount,
        createdAt: current.data && typeof current.data.createdAt === 'number' ? current.data.createdAt : input.now,
        updatedAt: input.now,
      },
    });
    await pairRef.set({
      data: {
        pairId: input.pairId,
        targetId: input.targetId,
        helperId: input.helperId,
        date: input.date,
        resourceType: input.resourceType,
        nonce: input.nonce,
        createdAt: input.now,
      },
    });
    return { granted: true, reason: null, dailyCount };
  });
}
