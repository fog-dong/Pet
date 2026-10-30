// STATUS: implemented, W12-1 事务冲突重试与重试耗尽用例（本地 mock 注入冲突，不连真实云环境）
// API: createTransactionCases(ctx) → [{ title, run }]
'use strict';

function createTransactionCases(ctx) {
  const { sdk, loadFunction, shanghaiDate, check } = ctx;
  const dailyId = (openid) => `${openid}_${shanghaiDate()}`;
  const adEvent = { adSessionId: 'tx-ad-1', adUnitId: 'adunit_test', scene: 'extra_check', isEnded: true };
  const assistEvent = { friendOpenid: 'friend_tx', resourceType: 'heart', nonce: 'n-tx' };

  async function adEventRetryOnce() {
    sdk.resetState();
    sdk.setOpenid('user_tx_ad');
    const fn = loadFunction('adEvent');
    sdk.injectTransactionConflicts(1);
    const first = await fn.main(adEvent);
    const attempts = sdk.transactionAttempts();
    check('第 1 次冲突后重试成功（code=0 且 granted=true）',
      first.code === 0 && first.data && first.data.granted === true, `code=${first.code}`);
    check('事务确实重试：共 2 次尝试', attempts === 2, `实际 ${attempts} 次`);
    check('重试成功后只发 1 次奖、不留重复写入',
      first.data.todayCount === 1 && sdk.fieldOf('ad_daily', dailyId('user_tx_ad'), 'count') === 1 && sdk.count('ad_events') === 1,
      `todayCount=${first.data.todayCount} count=${sdk.fieldOf('ad_daily', dailyId('user_tx_ad'), 'count')} 行数=${sdk.count('ad_events')}`);
    const replay = await fn.main(adEvent);
    check('重试后再重放仍回放首次结果，不新增行',
      replay.data.granted === true && replay.data.todayCount === 1 && sdk.count('ad_events') === 1);
  }

  async function adEventExhausted() {
    sdk.resetState();
    sdk.setOpenid('user_tx_ad_fail');
    const fn = loadFunction('adEvent');
    sdk.injectTransactionConflicts(3);
    const response = await fn.main(adEvent);
    check('3 次冲突后返回 1006 TRANSACTION_RETRY_EXHAUSTED',
      response.code === 1006 && response.msg === 'TRANSACTION_RETRY_EXHAUSTED' && response.data === null,
      `code=${response.code} msg=${response.msg}`);
    check('重试上限按 3 次执行', sdk.transactionAttempts() === 3, `实际 ${sdk.transactionAttempts()} 次`);
    check('重试耗尽不落任何文档', sdk.totalDocs() === 0, `实际 ${sdk.totalDocs()} 个文档`);
  }

  async function assistRetryOnce() {
    sdk.resetState();
    sdk.setOpenid('user_tx_assist');
    const fn = loadFunction('assist');
    sdk.injectTransactionConflicts(1);
    const response = await fn.main(assistEvent);
    check('第 1 次冲突后重试成功（granted=true、dailyCount=1）',
      response.code === 0 && response.data.granted === true && response.data.dailyCount === 1);
    check('事务重试 1 次（共 2 次尝试）', sdk.transactionAttempts() === 2, `实际 ${sdk.transactionAttempts()} 次`);
    check('助力成功后 pair 与计数各 1 条，无重复写入',
      sdk.count('assist_pairs') === 1 && sdk.fieldOf('assist_daily', dailyId('user_tx_assist'), 'count') === 1,
      `pair=${sdk.count('assist_pairs')} count=${sdk.fieldOf('assist_daily', dailyId('user_tx_assist'), 'count')}`);
  }

  async function assistExhausted() {
    sdk.resetState();
    sdk.setOpenid('user_tx_assist_fail');
    const fn = loadFunction('assist');
    sdk.injectTransactionConflicts(3);
    const response = await fn.main(assistEvent);
    check('3 次冲突后返回 1006 TRANSACTION_RETRY_EXHAUSTED',
      response.code === 1006 && response.msg === 'TRANSACTION_RETRY_EXHAUSTED' && response.data === null);
    check('重试耗尽不留下 pair、不留下计数（无中间态）',
      sdk.totalDocs() === 0, `实际 ${sdk.totalDocs()} 个文档`);
  }

  async function assistNonConflict() {
    sdk.resetState();
    sdk.setOpenid('user_tx_denied');
    const fn = loadFunction('assist');
    sdk.injectTransactionFailure('DATABASE_PERMISSION_DENIED', 'permission denied');
    let threw = false;
    try {
      await fn.main(assistEvent);
    } catch {
      threw = true;
    }
    check('非冲突异常不上报 1006，按原样上抛', threw);
    check('非冲突异常不重试（只 1 次尝试）', sdk.transactionAttempts() === 1, `实际 ${sdk.transactionAttempts()} 次`);
  }

  return [
    { title: '  [8] adEvent 事务：第 1 次冲突、第 2 次成功', run: adEventRetryOnce },
    { title: '  [9] adEvent 事务：3 次全冲突（重试耗尽）', run: adEventExhausted },
    { title: '  [10] assist 事务：第 1 次冲突、第 2 次成功', run: assistRetryOnce },
    { title: '  [11] assist 事务：3 次全冲突（重试耗尽）', run: assistExhausted },
    { title: '  [12] assist 事务：非冲突异常不重试、不伪装成 1006', run: assistNonConflict },
  ];
}

module.exports = { createTransactionCases };
