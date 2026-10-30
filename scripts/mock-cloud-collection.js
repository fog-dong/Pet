// STATUS: implemented, W12-1 从 mock-cloud-db.js 拆出的集合替身（主键冲突 / 唯一索引 / _.inc）
// API: MockCollection, applyPatch — 只服务 scripts/mock-cloud-db.js
'use strict';

const INC = Symbol('inc');

/** 与《集合与索引冻结》一致的复合唯一索引；真实环境靠 _id 主键，这里做二次约束验证。 */
const UNIQUE_INDEXES = {
  assist_pairs: [['targetId', 'helperId', 'date']],
  ad_events: [['openid', 'adSessionId']],
  leaderboard: [['type', 'period', 'openid']],
};

function duplicateError(message) {
  const error = new Error(message);
  error.errCode = -1;
  return error;
}

function matches(doc, query) {
  return Object.keys(query).every((key) => doc[key] === query[key]);
}

function applyPatch(doc, patch) {
  for (const key of Object.keys(patch)) {
    const value = patch[key];
    if (value && typeof value === 'object' && value[INC] !== undefined) {
      const base = typeof doc[key] === 'number' ? doc[key] : 0;
      doc[key] = base + value[INC];
    } else {
      doc[key] = value;
    }
  }
}

class MockCollection {
  constructor(store, name) {
    this.store = store;
    this.name = name;
  }

  docs() {
    if (!this.store.has(this.name)) {
      this.store.set(this.name, new Map());
    }
    return this.store.get(this.name);
  }

  doc(id) {
    const collection = this;
    return {
      async get() {
        return { data: collection.docs().get(id) ?? null };
      },
      async set({ data }) {
        collection.docs().set(id, Object.assign({ ...data }, { _id: id }));
      },
      async update({ data }) {
        const current = collection.docs().get(id);
        if (!current) {
          return { stats: { updated: 0 } };
        }
        applyPatch(current, data);
        return { stats: { updated: 1 } };
      },
      async remove() {
        const existed = collection.docs().delete(id);
        return { stats: { removed: existed ? 1 : 0 } };
      },
    };
  }

  where(query) {
    const collection = this;
    const rows = () => [...collection.docs().values()].filter((doc) => matches(doc, query));
    return {
      limit(count) {
        return {
          async get() {
            return { data: rows().slice(0, count) };
          },
          async count() {
            return { total: Math.min(rows().length, count) };
          },
        };
      },
      async get() {
        return { data: rows() };
      },
      async count() {
        return { total: rows().length };
      },
    };
  }

  async add({ data }) {
    const rows = this.docs();
    const id = data._id ?? `auto-${rows.size + 1}`;
    if (rows.has(id)) {
      throw duplicateError(`document with _id ${id} already exists`);
    }
    const indexes = UNIQUE_INDEXES[this.name] ?? [];
    for (const fields of indexes) {
      for (const other of rows.values()) {
        if (fields.every((field) => other[field] === data[field])) {
          throw duplicateError(`duplicate key uk_${fields.join('_')}`);
        }
      }
    }
    rows.set(id, { ...data, _id: id });
    return { _id: id };
  }
}

module.exports = { MockCollection, applyPatch, INC };
