// STATUS: implemented, W10-5/W21 数据库事务替身；W12-1 补冲突注入与按 times 重试语义
// API: createRunTransaction(store, helpers, control) — 只服务 scripts/mock-cloud-db.js
'use strict';

const DEFAULT_RETRIES = 3;

/**
 * 真实 SDK 只在事务冲突时自动重试（默认 3 次），其余异常一次抛出。
 * 替身按同一语义实现：control.conflicts 里预置的冲突在 handler 执行前抛出，
 * 因此「重试耗尽」分支不会留下任何半写状态，等价于真实事务的原子回滚。
 * 串行队列保证同文档读改写互斥，12 路并发用例不依赖微任务时序。
 */
function createRunTransaction(store, helpers, control) {
  const clone = helpers.clone;
  const applyPatch = helpers.applyPatch;
  let tail = Promise.resolve();

  function rows(name) {
    if (!store.has(name)) {
      store.set(name, new Map());
    }
    return store.get(name);
  }

  function transaction() {
    return {
      collection(name) {
        return {
          doc(id) {
            return {
              async get() {
                const row = rows(name).get(id);
                return { data: row ? clone(row) : null };
              },
              async set({ data }) {
                rows(name).set(id, Object.assign(clone(data), { _id: id }));
              },
              async update({ data }) {
                const row = rows(name).get(id);
                if (row) {
                  applyPatch(row, data);
                }
              },
            };
          },
        };
      },
    };
  }

  function conflictError() {
    const error = new Error('transaction conflict: document was modified by another transaction');
    error.errCode = 'DATABASE_TRANSACTION_CONFLICT';
    return error;
  }

  async function execute(handler, maxAttempts) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      control.attempts += 1;
      if (control.failure) {
        const failure = control.failure;
        control.failure = null;
        throw failure;
      }
      if (control.conflicts > 0) {
        control.conflicts -= 1;
        if (attempt === maxAttempts) {
          throw conflictError();
        }
        continue;
      }
      return handler(transaction());
    }
    throw conflictError();
  }

  return function runTransaction(handler, times) {
    const maxAttempts = Number.isInteger(times) && times > 0 ? times : DEFAULT_RETRIES;
    const run = tail.then(() => execute(handler, maxAttempts));
    tail = run.then(() => undefined, () => undefined);
    return run;
  };
}

module.exports = { createRunTransaction, DEFAULT_RETRIES };
