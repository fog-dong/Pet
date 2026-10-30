// STATUS: implemented, W10-5/W21 数据库事务替身（串行执行 handler，复现同文档读改写的互斥）
// API: createRunTransaction(store, helpers) — 只服务 scripts/mock-cloud-db.js
'use strict';

/**
 * 真实 SDK 的 `runTransaction` 对同一文档的并发事务会冲突并重试（默认 3 次），效果等价于串行；
 * 替身直接用 promise 队列串行化，因此「12 个并发上报只发 10 次奖」这类断言不依赖微任务时序。
 * 写入即时落到 store，不复现 handler 中途抛错时的回滚——现有用例不依赖该行为。
 */
function createRunTransaction(store, helpers) {
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

  return function runTransaction(handler) {
    const run = tail.then(() => handler(transaction()));
    tail = run.then(() => undefined, () => undefined);
    return run;
  };
}

module.exports = { createRunTransaction };
