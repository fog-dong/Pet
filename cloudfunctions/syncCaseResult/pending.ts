// STATUS: implemented, W14-1 服务端 pending 标记（仅诊断：2002 时记一条，成功清算时删除，不参与发奖）
import * as cloud from 'wx-server-sdk';

const COLLECTION = 'sync_pending';

interface PendingDoc {
  firstSeenAt?: number;
}

function pendingRef(openid: string, caseSessionId: string): cloud.DocumentRef<PendingDoc> {
  // throwOnNotFound=false：首次上报时文档不存在应返回 null，而不是抛异常打断 2002 返回。
  return cloud
    .database({ throwOnNotFound: false })
    .collection<PendingDoc>(COLLECTION)
    .doc(`${openid}:${caseSessionId}`);
}

/**
 * 2002 时落标记：同一局保留最早的 firstSeenAt，后续失败只更新 lastSeenAt/lastCode。
 * 标记写失败不影响结算返回，监控最多漏一条，不能反过来让上报 500。
 */
export async function markPending(
  openid: string,
  caseSessionId: string,
  caseId: string,
  code: number,
  now: number,
): Promise<void> {
  try {
    const ref = pendingRef(openid, caseSessionId);
    const existing = await ref.get();
    const firstSeenAt = typeof existing.data?.firstSeenAt === 'number' ? existing.data.firstSeenAt : now;
    await ref.set({
      data: { openid, caseSessionId, caseId, firstSeenAt, lastSeenAt: now, lastCode: code },
    });
  } catch {
    console.warn('[syncCaseResult] pending marker failed id=%s', caseSessionId);
  }
}

/** 清算成功或终态失败时删除标记；删除失败只留一条孤儿，等 TTL 到期由运维清理。 */
export async function clearPending(openid: string, caseSessionId: string): Promise<void> {
  try {
    await pendingRef(openid, caseSessionId).remove();
  } catch {
    // 标记清理失败不阻塞主流程。
  }
}
