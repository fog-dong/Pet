// STATUS: implemented, W13-2 客户端 2002 容错回归（用 Node 直接加载 assets 下的纯模块，不连云环境）
'use strict';

const path = require('path');
const { pathToFileURL } = require('url');

const NET_DIR = path.join(__dirname, '..', 'assets', 'scripts', 'net');
const CACHE_DIR = path.join(__dirname, '..', 'assets', 'scripts', 'cache');

let failed = 0;
function check(title, passed, detail) {
  if (passed) {
    console.log(`    OK   ${title}${detail ? ` → ${detail}` : ''}`);
    return;
  }
  failed += 1;
  console.log(`    FAIL ${title}${detail ? ` → ${detail}` : ''}`);
}

async function load(name, dir) {
  return import(pathToFileURL(path.join(dir, `${name}.ts`)).href);
}

/** 落盘替身：只保留 PendingSync 的「按 caseSessionId 去重 + 成功出队」语义。 */
function createQueue(initial) {
  let rows = initial.map((item) => ({ ...item }));
  return {
    rows: () => rows.map((item) => ({ ...item })),
    keep(verdicts) {
      // 只把 ok / drop 视作出队；本轮没走到（retry 提前停止）的条目原样保留。
      rows = rows.filter((_, index) => verdicts[index] !== 'ok' && verdicts[index] !== 'drop');
    },
    push(item) {
      rows = rows.filter((row) => row.caseSessionId !== item.caseSessionId);
      rows.push({ ...item });
    },
  };
}

async function main() {
  const { classifySyncCode, drainQueue } = await load('SyncPolicy', NET_DIR);
  const { isPendingExpired, PENDING_TTL_MS } = await load('PendingTtl', CACHE_DIR);

  console.log('\n[1] 错误码分类：2002 不再等于终态');
  check('0 → ok', classifySyncCode(0) === 'ok', classifySyncCode(0));
  check('2002 → defer（可恢复，留队重试）', classifySyncCode(2002) === 'defer', classifySyncCode(2002));
  check('1002 → drop（参数错误，重发无意义）', classifySyncCode(1002) === 'drop', classifySyncCode(1002));
  check('1004 → drop（主键冲突回放）', classifySyncCode(1004) === 'drop', classifySyncCode(1004));
  check('1006 → retry（服务端忙，本轮停）', classifySyncCode(1006) === 'retry', classifySyncCode(1006));
  check('-1 网络失败 → retry', classifySyncCode(-1) === 'retry', classifySyncCode(-1));

  console.log('\n[2] 连续 3 轮补发都返回 2002：该局留在 pending 队列，不丢弃');
  const queue = createQueue([{ caseSessionId: 'case-fixed-0001', caseId: 'case_cat_cold' }]);
  const rounds = [];
  for (let i = 0; i < 3; i += 1) {
    // 每轮对应一个触发点：启动 / 进厅 / 下局结算后。
    const round = await drainQueue(queue.rows(), async () => 2002);
    queue.keep(round.verdicts);
    rounds.push(round);
  }
  check('三轮都判为 defer', rounds.every((round) => round.verdicts[0] === 'defer'), rounds.map((r) => r.verdicts.join('/')).join(' '));
  check('没有一局被丢弃，队列仍为 1 条', queue.rows().length === 1, `队列=${queue.rows().length}`);
  check('三轮都没有把 2002 当成已上报', rounds.every((round) => round.sent === 0), `sent=${rounds.map((r) => r.sent).join(',')}`);
  check('2002 不中断本轮（配置恢复后后面的队列照常推进）', rounds.every((round) => round.stopped === false),
    `stopped=${rounds.map((r) => r.stopped).join(',')}`);

  console.log('\n[3] 配置发布后第 4 次调用成功：队列移除、只入账一次');
  const second = await drainQueue(queue.rows(), async () => 0);
  queue.keep(second.verdicts);
  check('第 4 次返回 0 → ok', second.verdicts[0] === 'ok', second.verdicts.join(','));
  check('成功后队列清空', queue.rows().length === 0, `队列=${queue.rows().length}`);
  check('只计一次入账', second.sent === 1, `sent=${second.sent}`);

  console.log('\n[4] 网络失败：本轮立即停，不空转');
  const busy = createQueue([
    { caseSessionId: 's1', caseId: 'c1' },
    { caseSessionId: 's2', caseId: 'c2' },
  ]);
  let sends = 0;
  const third = await drainQueue(busy.rows(), async () => {
    sends += 1;
    return -1;
  });
  busy.keep(third.verdicts);
  check('网络失败判为 retry 并停止本轮', third.stopped === true && third.verdicts[0] === 'retry', `stopped=${third.stopped}`);
  check('只尝试 1 条，不连打', sends === 1 && third.verdicts.length === 1, `尝试=${sends}`);
  check('两条都留在队列', busy.rows().length === 2, `队列=${busy.rows().length}`);

  console.log('\n[5] 2002 与成功混排：只有成功的那条出队');
  const mixed = createQueue([
    { caseSessionId: 'a', caseId: 'c1' },
    { caseSessionId: 'b', caseId: 'c2' },
  ]);
  const answers = [2002, 0];
  let pick = 0;
  const fourth = await drainQueue(mixed.rows(), async () => answers[pick++]);
  mixed.keep(fourth.verdicts);
  check('判定序列为 defer,ok', fourth.verdicts.join(',') === 'defer,ok', fourth.verdicts.join(','));
  check('执行掉成功那条，保留 2002 那条', mixed.rows().length === 1 && mixed.rows()[0].caseSessionId === 'a',
    `队列=${mixed.rows().map((r) => r.caseSessionId).join(',')}`);

  console.log('\n[6] 过期策略：沿用 W16 的 7 天口径');
  const now = Date.now();
  check('7 天内有效', isPendingExpired(now - PENDING_TTL_MS + 60 * 1000, now) === false);
  check('超过 7 天过期', isPendingExpired(now - PENDING_TTL_MS - 60 * 1000, now) === true);
  check('缺 enqueuedAt 视为过期', isPendingExpired(undefined, now) === true);

  if (failed > 0) {
    console.log(`\n结果：${failed} 项失败`);
    process.exit(1);
  }
  console.log('\n结果：全部通过');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
