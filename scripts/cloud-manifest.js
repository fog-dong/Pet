'use strict';
// STATUS: implemented, W21-7 云部署清单单一真源
// 两个部署脚本共用：deploy-cloud.js（微信开发者工具 CLI）与 deploy-all-cloud.js（cloudbase-cli / tcb）。
// 顺序口径来源：《W7-云函数部署操作单》§3；集合口径来源：《数据库初始化清单》§2。改这里必须同步那两份文档。

const fs = require('fs');
const path = require('path');

const DEPLOY_ORDER = [
  'login', 'getConfig', 'saveGame', 'syncCaseResult', 'leaderboard',
  'assist', 'adEvent', 'createOrder', 'payCallback', 'getProfile',
  'trackEvent', 'pendingMonitor', 'claimHabitat',
];

// CLI 只部署函数代码，定时触发器必须人工补做。
const TRIGGER_FUNCTIONS = ['pendingMonitor'];

// 只有主键、不需要二级索引的集合（《数据库初始化清单》§3 末注）。
const PRIMARY_KEY_ONLY = ['assist_pairs', 'assist_daily', 'ad_daily', 'habitat_state', 'habitat_claims'];

const COLLECTIONS = [
  'users', 'hospital_state', 'pets_cases', 'pets', 'adoptions', 'ad_events',
  'orders', 'config', 'leaderboard', 'assist_logs', 'delivery_logs',
  'assist_pairs', 'assist_daily', 'track_events', 'ad_daily', 'sync_pending',
  'habitat_state', 'habitat_claims',
];

/** 部署前本地自检：产物齐不齐、是不是生成物、有没有手改风险。 */
function inspectFunction(fnRoot, name) {
  const dir = path.join(fnRoot, name);
  const problems = [];
  if (!fs.existsSync(dir)) problems.push('目录不存在');
  if (!fs.existsSync(path.join(dir, 'index.js'))) problems.push('缺 index.js（先跑 npm run build:cloud）');
  if (!fs.existsSync(path.join(dir, 'package.json'))) problems.push('缺 package.json（无法装依赖）');
  const entry = path.join(dir, 'index.js');
  if (fs.existsSync(entry)) {
    const head = fs.readFileSync(entry, 'utf8').split('\n', 1)[0];
    if (!head.includes('GENERATED from index.ts')) problems.push('index.js 首行缺少 GENERATED 标记，疑为手改产物');
  }
  const ts = path.join(dir, 'index.ts');
  if (fs.existsSync(ts) && fs.existsSync(entry) && fs.statSync(ts).mtimeMs > fs.statSync(entry).mtimeMs) {
    problems.push('index.ts 比 index.js 新，产物过期');
  }
  return { dir, problems };
}

/** 两个部署脚本共用的命令行解析。`--k=v` 与 `--k v` 都认。 */
function argValue(args, name) {
  const hit = args.find((item) => item.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? (args[at + 1] || '') : '';
}

/** `--only login getConfig` 这类空格分隔的取值列表。 */
function argList(args, name) {
  const at = args.indexOf(`--${name}`);
  if (at < 0) return [];
  const out = [];
  for (let i = at + 1; i < args.length && !args[i].startsWith('--'); i += 1) out.push(args[i]);
  return out;
}

module.exports = {
  DEPLOY_ORDER, TRIGGER_FUNCTIONS, COLLECTIONS, PRIMARY_KEY_ONLY,
  inspectFunction, argValue, argList,
};
