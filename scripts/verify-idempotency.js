// STATUS: implemented, W9-6 云函数幂等本地回归（不连真实云环境）
// API: npm run verify:idempotency — 三个用例各重复调用 3 次，输出实际返回值与判定
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
  const count = sdk.firstFieldOf('assist_daily', 'count');
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
  check('ad_events 仅 1 条', sdk.count('ad_events') === 1, `实际 ${sdk.count('ad_events')} 条`);
}

async function main() {
  results.push('幂等回归（本地 mock db，未连接任何云环境）');
  await caseSyncCaseResult();
  await caseAssist();
  await caseAdEvent();
  results.push('');
  results.push(failures === 0 ? '结果：3 个用例全部通过' : `结果：${failures} 项断言失败`);
  console.log(results.join('\n'));
  process.exitCode = failures === 0 ? 0 : 1;
}

void main();
