// STATUS: implemented, W9-6 云函数幂等本地回归（不连真实云环境）；W10-5/W21 加 adEvent 并发用例
// API: npm run verify:idempotency — 顺序重试用例 + 并发用例，输出实际返回值与判定
'use strict';

const path = require('path');
const Module = require('module');
const { createSdk } = require('./mock-cloud-db');

const sdk = createSdk();
const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === 'wx-server-sdk') {
    return sdk;
  }
  return originalLoad.call(this, request, parent, isMain);
};

function loadFunction(name) {
  const file = path.join(__dirname, '..', 'cloudfunctions', name, 'index.js');
  delete require.cache[require.resolve(file)];
  return require(file);
}

/** 与云函数一致的北京时间切日；`ad_daily` / `assist_daily` 的 _id 都按 `openid_日期` 定位。 */
function shanghaiDate() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

/** 某个 openid 当日的 ad_daily 计数（W21 起上限判定全部落在这个文档上）。 */
function dailyCount(openid) {
  return sdk.fieldOf('ad_daily', `${openid}_${shanghaiDate()}`, 'count');
}

const results = [];
let failures = 0;

function check(label, passed, detail) {
  results.push(`    ${passed ? 'OK  ' : 'FAIL'} ${label}${detail === undefined ? '' : ` → ${detail}`}`);
  if (!passed) {
    failures += 1;
  }
}

function show(label, response) {
  results.push(`    ${label} ${JSON.stringify({ code: response.code, msg: response.msg, data: response.data })}`);
}

async function caseSyncCaseResult() {
  results.push('  [1] syncCaseResult：同一 caseSessionId 连续 3 次');
  sdk.resetState();
  sdk.setOpenid('user_case');
  const fn = loadFunction('syncCaseResult');
  const event = {
    caseSessionId: 'session-fixed-0001',
    caseId: 'case_cat_cold',
    diagnosis: { disease: 'cold', correct: true },
    treatment: { steps: 3, correct: true },
    durationMs: 42000,
  };
  const calls = [];
  for (let i = 0; i < 3; i += 1) {
    const response = await fn.main(event);
    calls.push(response);
    show(`第 ${i + 1} 次`, response);
  }
  const same = calls.every((r) => JSON.stringify(r.data) === JSON.stringify(calls[0].data) && r.code === calls[0].code);
  check('三次返回一致', same);
  check('未产生任何写入（结算尚未实现，返回空结构）', sdk.dump().join(',') === '', sdk.dump().join(',') || '写入 0 个文档');
  results.push('    注：syncCaseResult 仍是校验骨架，不发奖、不写库；金币结算落地后本用例改为断言“只第一次发奖”。');
}

async function caseAssist() {
  results.push('  [2] assist：同一 openid + friendOpenid + 自然日 连续 3 次');
  sdk.resetState();
  sdk.setOpenid('user_target');
  const fn = loadFunction('assist');
  const event = { friendOpenid: 'share_2026-10-30_1', resourceType: 'heart', nonce: 'n1' };
  const responses = [];
  for (let i = 0; i < 3; i += 1) {
    const response = await fn.main(event);
    responses.push(response);
    show(`第 ${i + 1} 次`, response);
  }
  const first = responses[0].data;
  check('只有第 1 次 granted=true', first && first.granted === true);
  check('第 2、3 次 granted=false 且 ALREADY_ASSISTED',
    responses.slice(1).every((r) => r.data && r.data.granted === false && r.data.reason === 'ALREADY_ASSISTED'));
  check('assist_pairs 仅 1 条（主键 targetId_helperId_date）', sdk.count('assist_pairs') === 1, `实际 ${sdk.count('assist_pairs')} 条`);
  const count = sdk.fieldOf('assist_daily', `user_target_${shanghaiDate()}`, 'count');
  check('assist_daily.count 不重复累加', count === 1, `实际 count=${count}`);
}

async function caseAdEvent() {
  results.push('  [3] adEvent：同一 idempotencyKey（openid:adSessionId）连续 3 次');
  sdk.resetState();
  sdk.setOpenid('user_ad');
  const fn = loadFunction('adEvent');
  const event = { adSessionId: 'session-ad-0001', adUnitId: 'adunit_test', scene: 'extra_check', isEnded: true };
  const responses = [];
  for (let i = 0; i < 3; i += 1) {
    const response = await fn.main(event);
    responses.push(response);
    show(`第 ${i + 1} 次`, response);
  }
  check('三次都 granted=true（回放首次结果）', responses.every((r) => r.data && r.data.granted === true));
  check('todayCount 恒为 1，不重复计数', responses.every((r) => r.data && r.data.todayCount === 1));
  check('ad_events 仅 1 条、ad_daily.count 恒为 1',
    sdk.count('ad_events') === 1 && dailyCount('user_ad') === 1, `行数=${sdk.count('ad_events')} count=${dailyCount('user_ad')}`);
}

/** W21：并发上报不同会话时，当日上限必须靠事务内的原子读改写守住，而不是先查后写。 */
async function caseAdEventRace() {
  results.push('  [4] adEvent 并发：12 个不同 adSessionId 同时上报（全局上限 10）');
  sdk.resetState();
  sdk.setOpenid('user_race');
  const fn = loadFunction('adEvent');
  const events = Array.from({ length: 12 }, (_, i) => ({ adSessionId: `race-${i}`, adUnitId: 'adunit_test', scene: 'extra_check', isEnded: true }));
  const responses = await Promise.all(events.map((event) => fn.main(event)));
  const granted = responses.filter((r) => r.data && r.data.granted).map((r) => r.data.todayCount).sort((a, b) => a - b);
  const expected = Array.from({ length: 10 }, (_, i) => i + 1);
  check('恰好 10 次 granted=true（并发不越当日上限）', granted.length === 10, `实际 ${granted.length} 次`);
  check('todayCount 为 1..10 且无重复', JSON.stringify(granted) === JSON.stringify(expected), `实际 ${granted.join(',')}`);
  check('ad_daily.count 停在 10（超限的 2 次不占额度）', dailyCount('user_race') === 10, `实际 count=${dailyCount('user_race')}`);
  const rows = sdk.rows('ad_events');
  check('ad_events 12 行全落库、其中 2 行 granted=false',
    rows.length === 12 && rows.filter((r) => r.granted === false).length === 2, `实际 ${rows.length} 行`);
  results.push('  [5] adEvent 并发：同一 adSessionId 同时上报 2 次');
  sdk.resetState();
  sdk.setOpenid('user_dup');
  const dup = { adSessionId: 'session-dup', adUnitId: 'adunit_test', scene: 'extra_check', isEnded: true };
  const twice = await Promise.all([fn.main(dup), fn.main(dup)]);
  check('两次都 granted=true 且 todayCount 恒为 1',
    twice.every((r) => r.code === 0 && r.data && r.data.granted === true && r.data.todayCount === 1));
  check('重复会话不双计：ad_daily.count=1 且仅 1 行',
    dailyCount('user_dup') === 1 && sdk.count('ad_events') === 1, `count=${dailyCount('user_dup')} 行数=${sdk.count('ad_events')}`);
}

async function main() {
  results.push('幂等回归（本地 mock db，未连接任何云环境）');
  await caseSyncCaseResult();
  await caseAssist();
  await caseAdEvent();
  await caseAdEventRace();
  results.push('');
  results.push(failures === 0 ? '结果：5 个用例全部通过' : `结果：${failures} 项断言失败`);
  console.log(results.join('\n'));
  process.exitCode = failures === 0 ? 0 : 1;
}

void main();
