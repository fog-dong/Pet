// STATUS: implemented, W9-6 云开发数据库本地替身；W12-1 加冲突注入、文档计数，并把集合替身拆到 mock-cloud-collection.js
// API: createSdk(), sdk.resetState(), sdk.setOpenid(), sdk.injectTransactionConflicts(n) — 只服务 scripts/verify-idempotency.js
'use strict';

const { createRunTransaction } = require('./mock-cloud-transaction');
const { MockCollection, applyPatch, INC } = require('./mock-cloud-collection');

function createSdk() {
  const store = new Map();
  const context = { OPENID: '' };
  const control = { conflicts: 0, failure: null, attempts: 0 };
  const runTransaction = createRunTransaction(store, {
    clone: (value) => JSON.parse(JSON.stringify(value)),
    applyPatch,
  }, control);
  const database = () => ({
    collection: (name) => new MockCollection(store, name),
    command: { inc: (n) => ({ [INC]: n }) },
    runTransaction,
  });
  return {
    DYNAMIC_CURRENT_ENV: 'MOCK_ENV',
    init: () => undefined,
    database,
    getWXContext: () => ({ ...context }),
    resetState: () => {
      store.clear();
      context.OPENID = '';
      control.conflicts = 0;
      control.failure = null;
      control.attempts = 0;
    },
    setOpenid: (openid) => {
      context.OPENID = openid;
    },
    /** 接下来 n 次事务尝试全部按冲突失败，用于验证重试路径与重试耗尽路径。 */
    injectTransactionConflicts: (n) => {
      control.conflicts = n;
      control.attempts = 0;
    },
    /** 注入一次非冲突异常：真实 SDK 不会重试，应原样上抛。 */
    injectTransactionFailure: (errCode, message) => {
      const error = new Error(message);
      error.errCode = errCode;
      control.failure = error;
      control.attempts = 0;
    },
    transactionAttempts: () => control.attempts,
    dump: () => [...store.entries()].map(([name, rows]) => `${name}=${rows.size}`),
    /** 真实文档总数：空集合（读操作惰性建的空 Map）不计入。 */
    totalDocs: () => [...store.values()].reduce((sum, rows) => sum + rows.size, 0),
    count: (name) => (store.get(name) ? store.get(name).size : 0),
    rows: (name) => (store.get(name) ? [...store.get(name).values()] : []),
    fieldOf: (name, id, field) => {
      const row = store.get(name) ? store.get(name).get(id) : undefined;
      return row ? row[field] : undefined;
    },
  };
}

module.exports = { createSdk };
