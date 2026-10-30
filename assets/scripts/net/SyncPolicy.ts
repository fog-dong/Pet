// STATUS: implemented, W13-2 上报结果分类（2002 配置未发布算可恢复，不再丢弃；纯函数，便于本地回归）

/** 0 成功、1002 参数错误、1004 冲突回放、2002 病例配置未发布、1006 事务重试耗尽。 */
export type SyncVerdict = 'ok' | 'drop' | 'defer' | 'retry';

const CODE_OK = 0;
const CODE_PARAM = 1002;
const CODE_REPLAY_CONFLICT = 1004;
const CODE_STATE_INVALID = 2002;
const CODE_RETRY_EXHAUSTED = 1006;

/**
 * ok=已入账，出队；drop=重发也不会成功，出队并记丢弃；
 * defer=配置/状态可恢复（2002），留队继续试下一条；retry=网络或服务端忙，留队并结束本轮。
 */
export function classifySyncCode(code: number): SyncVerdict {
  if (code === CODE_OK) {
    return 'ok';
  }
  if (code === CODE_STATE_INVALID) {
    return 'defer';
  }
  if (code < 0 || code === CODE_RETRY_EXHAUSTED) {
    return 'retry';
  }
  if (code === CODE_PARAM || code === CODE_REPLAY_CONFLICT) {
    return 'drop';
  }
  return 'drop';
}

export interface DrainResult {
  sent: number;
  deferred: number;
  stopped: boolean;
  /** 与入参同序的判定，便于调用方与测试复核“哪一条留下、哪一条出队”。 */
  verdicts: SyncVerdict[];
}

/** 逐条补发：成功计数，defer 跳过继续，retry 立即停止本轮（网络/服务端忙时不再连打）。 */
export async function drainQueue<T>(items: readonly T[], send: (item: T) => Promise<number>): Promise<DrainResult> {
  let sent = 0;
  let deferred = 0;
  const verdicts: SyncVerdict[] = [];
  for (const item of items) {
    const verdict = classifySyncCode(await send(item));
    verdicts.push(verdict);
    if (verdict === 'retry') {
      return { sent, deferred, stopped: true, verdicts };
    }
    if (verdict === 'ok') {
      sent += 1;
    } else if (verdict === 'defer') {
      deferred += 1;
    }
  }
  return { sent, deferred, stopped: false, verdicts };
}

/** 大厅角标文案：0 条时返回空串，避免上一轮的提示残留。 */
export function pendingBadgeText(count: number): string {
  return count > 0 ? `有 ${count} 局结算待同步，稍后自动补发` : '';
}
