// STATUS: implemented, W9-6 云函数幂等本地回归（不连真实云环境）；W11-1 拆成 runner + 用例模块；W12-1 加事务重试用例
// API: npm run verify:idempotency — 顺序 [1]-[3] + 并发 [4]-[7] + 事务重试 [8]-[12]，输出实际返回值与判定
'use strict';

const path = require('path');
const Module = require('module');
const { createSdk } = require('./mock-cloud-db');
const { createSequentialCases } = require('./verify-cases');
const { createRaceCases } = require('./verify-cases-race');
const { createTransactionCases } = require('./verify-cases-transaction');

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

async function main() {
  results.push('幂等回归（本地 mock db，未连接任何云环境）');
  const ctx = { sdk, loadFunction, shanghaiDate, check, show, results };
  const cases = [...createSequentialCases(ctx), ...createRaceCases(ctx), ...createTransactionCases(ctx)];
  for (const item of cases) {
    results.push(item.title);
    await item.run();
  }
  results.push('');
  results.push(failures === 0 ? `结果：${cases.length} 个用例全部通过` : `结果：${failures} 项断言失败`);
  console.log(results.join('\n'));
  process.exitCode = failures === 0 ? 0 : 1;
}

void main();
