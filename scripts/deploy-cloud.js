'use strict';
// STATUS: implemented, W20-4 收口 云函数一键部署（只生成并执行微信开发者工具 CLI 命令）
// 用途：把 cloudfunctions/ 下 13 个函数按依赖顺序部署到指定云环境。
// 默认 dry-run 只打印命令，加 --apply 才真正调用 CLI。部署动作属于人工操作：Agent 不得代跑 --apply。
// 用法：
//   node scripts/deploy-cloud.js --env <真实云环境ID>            # 预演
//   node scripts/deploy-cloud.js --env <真实云环境ID> --apply     # 真部署（需已登录开发者工具）
//   可选：--only login getConfig　--cli <cli.bat 路径>　--yes（跳过交互确认）

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const fnRoot = path.join(root, 'cloudfunctions');

// 顺序 = 《W7-云函数部署操作单》§3 的依赖序，改动需同步该文档。
const DEPLOY_ORDER = [
  'login', 'getConfig', 'saveGame', 'syncCaseResult', 'leaderboard',
  'assist', 'adEvent', 'createOrder', 'payCallback', 'getProfile',
  'trackEvent', 'pendingMonitor', 'claimHabitat',
];

// CLI 只部署函数代码，触发器不在范围内：这两个必须人工补做。
const TRIGGER_FUNCTIONS = ['pendingMonitor'];

// 顺序与《数据库初始化清单》§2 逐行对应（18 个），改动需同步该文档。
const COLLECTIONS = [
  'users', 'hospital_state', 'pets_cases', 'pets', 'adoptions', 'ad_events',
  'orders', 'config', 'leaderboard', 'assist_logs', 'delivery_logs',
  'assist_pairs', 'assist_daily', 'track_events', 'ad_daily', 'sync_pending',
  'habitat_state', 'habitat_claims',
];

const DEFAULT_CLI = [
  'C:/Program Files (x86)/微信web开发者工具/cli.bat',
  'C:/Program Files/腾讯/微信web开发者工具/cli.bat',
];

function argv() {
  const args = process.argv.slice(2);
  const flag = (name) => args.includes(name);
  const value = (name) => {
    const hit = args.find((item) => item.startsWith(`--${name}=`));
    if (hit) return hit.slice(name.length + 3);
    const at = args.indexOf(`--${name}`);
    return at >= 0 ? args[at + 1] : '';
  };
  const list = (name) => {
    const at = args.indexOf(`--${name}`);
    if (at < 0) return [];
    const out = [];
    for (let i = at + 1; i < args.length && !args[i].startsWith('--'); i += 1) out.push(args[i]);
    return out;
  };
  return {
    env: value('env') || process.env.CLOUD_ENV_ID || '',
    cli: value('cli') || process.env.WECHAT_DEVTOOLS_CLI || '',
    only: list('only'),
    apply: flag('apply'),
    yes: flag('yes'),
  };
}

function resolveCli(explicit) {
  const candidates = explicit ? [explicit] : DEFAULT_CLI;
  return candidates.find((item) => fs.existsSync(item)) || '';
}

/** 部署前的本地自检：产物齐不齐、是不是生成物、有没有手改风险。 */
function inspect(name) {
  const dir = path.join(fnRoot, name);
  const problems = [];
  if (!fs.existsSync(dir)) problems.push('目录不存在');
  if (!fs.existsSync(path.join(dir, 'index.js'))) problems.push('缺 index.js（先跑 npm run build:cloud）');
  if (!fs.existsSync(path.join(dir, 'package.json'))) problems.push('缺 package.json（云端无法装依赖）');
  const entry = path.join(dir, 'index.js');
  if (fs.existsSync(entry)) {
    const head = fs.readFileSync(entry, 'utf8').split('\n', 1)[0];
    if (!head.includes('GENERATED from index.ts')) problems.push('index.js 首行缺少 GENERATED 标记，疑为手改产物');
  }
  const ts = path.join(dir, 'index.ts');
  if (fs.existsSync(ts) && fs.existsSync(entry)) {
    if (fs.statSync(ts).mtimeMs > fs.statSync(entry).mtimeMs) problems.push('index.ts 比 index.js 新，产物过期');
  }
  return { dir, problems };
}

function main() {
  const opt = argv();
  const names = opt.only.length
    ? DEPLOY_ORDER.filter((item) => opt.only.includes(item))
    : DEPLOY_ORDER;

  if (!opt.env) {
    process.stdout.write('缺少 --env <云环境ID>（或环境变量 CLOUD_ENV_ID）。云环境 ID 在开发者工具「云开发」控制台顶部。\n');
    process.exit(2);
  }
  const cli = resolveCli(opt.cli);
  if (!cli) {
    process.stdout.write('找不到微信开发者工具 CLI。用 --cli 指定 cli.bat 路径，或设 WECHAT_DEVTOOLS_CLI。\n');
    process.exit(2);
  }

  process.stdout.write(`云环境：${opt.env}\nCLI：${cli}\n函数：${names.length} 个，按依赖顺序\n\n`);

  process.stdout.write(`【集合前置】以下 ${COLLECTIONS.length} 个集合必须已在控制台建好且关闭客户端直读直写，缺一个就会在事务里报错：\n`);
  process.stdout.write(`  ${COLLECTIONS.join('、')}\n`);
  process.stdout.write('  其中 ad_daily / sync_pending / habitat_state / habitat_claims 是本次收口新增的硬前置。\n');
  process.stdout.write('  另需在 config 集合发布 {configKey:"cases", status:"active"}，否则 syncCaseResult 恒返回 2002。\n\n');

  const plan = names.map((name) => {
    const info = inspect(name);
    const cmd = [
      cli, 'cloud', 'functions', 'deploy',
      '--env', opt.env,
      '--paths', info.dir,
      '--remote-npm-install',
    ];
    return { name, cmd, problems: info.problems };
  });

  const blocked = plan.filter((item) => item.problems.length);
  process.stdout.write('【本地自检】\n');
  plan.forEach((item) => {
    const mark = item.problems.length ? 'FAIL' : ' OK ';
    process.stdout.write(`  [${mark}] ${item.name}${item.problems.length ? ` — ${item.problems.join('；')}` : ''}\n`);
  });
  if (blocked.length) {
    process.stdout.write(`\n${blocked.length} 个函数未就绪，先修上面这些（通常是 npm run build:cloud），再重跑本脚本。\n`);
    process.exit(1);
  }

  process.stdout.write('\n【部署命令】（CLI 用 --paths 直连仓库目录，不需要 project.config.json 的 cloudfunctionRoot）\n');
  plan.forEach((item, idx) => {
    process.stdout.write(`  ${idx + 1}. ${item.cmd.map((p) => (p.includes(' ') ? `"${p}"` : p)).join(' ')}\n`);
  });

  if (!opt.apply) {
    process.stdout.write('\n（dry-run，未执行任何部署。加 --apply 才会调用 CLI。）\n');
    return;
  }

  if (!opt.yes) {
    process.stdout.write('\n--apply 会向云端上传并覆盖这 13 个函数。加 --yes 确认后继续。\n');
    process.exit(2);
  }

  plan.forEach((item) => {
    process.stdout.write(`\n→ 部署 ${item.name}\n`);
    const run = spawnSync(item.cmd[0], item.cmd.slice(1), { encoding: 'utf8', shell: true });
    process.stdout.write(run.stdout || '');
    process.stderr.write(run.stderr || '');
    if (run.status !== 0) {
      process.stdout.write(`${item.name} 部署失败（退出码 ${run.status}），后续函数未执行。先查是否已登录：cli login\n`);
      process.exit(1);
    }
  });

  process.stdout.write('\n全部函数部署完成。CLI 不上传定时触发器，还需人工补做：\n');
  TRIGGER_FUNCTIONS.forEach((name) => {
    process.stdout.write(`  · ${name}：在开发者工具里右键「上传触发器」，或在云开发控制台给该函数新建 timer 触发器（config.json 已写每日 09:00）。\n`);
  });
  process.stdout.write('  · login：确认环境变量 SESSION_SECRET 已配置，否则 login 抛 SESSION_SECRET_MISSING、其余函数全链路 1001。\n');
}

main();
