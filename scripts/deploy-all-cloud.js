'use strict';
// STATUS: implemented, W21-7 cloudbase-cli（tcb）一键部署
// 用途：把 cloudfunctions/ 下 13 个函数按依赖顺序部署到指定云环境，与 scripts/deploy-cloud.js 共用 cloud-manifest.js 的顺序与自检。
// 默认 dry-run 只打印命令。部署属人工操作：Agent 不得代跑 --apply。
// 前置：npm i -g @cloudbase/cli && tcb login（登录态与账号绑定，脚本不碰任何密钥）。
// 注意：--apply 会先用 `tcb env use <环境ID>` 把 CLI 的全局默认环境切到你填的环境，再逐个 fn deploy（本 CLI 的 fn deploy 没有 -e 参数）。
// 用法：
//   node scripts/deploy-all-cloud.js --detect                     # 只列出当前账号可见的云环境 ID
//   node scripts/deploy-all-cloud.js --env <云环境ID>              # 预演（含 npm install 与 tcb fn deploy 两类命令）
//   node scripts/deploy-all-cloud.js --env <云环境ID> --apply --yes  # 真部署
//   可选：--only login getConfig　--remote-deps（云端装依赖，跳过本地 npm install）　--tcb <可执行文件>

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { DEPLOY_ORDER, TRIGGER_FUNCTIONS, COLLECTIONS, inspectFunction, argValue, argList } = require('./cloud-manifest');
const { printEnvIds } = require('./cloudbase-env');

const root = path.join(__dirname, '..');
const fnRoot = path.join(root, 'cloudfunctions');

function argv() {
  const args = process.argv.slice(2);
  const flag = (name) => args.includes(`--${name}`);
  return {
    env: argValue(args, 'env') || process.env.CLOUD_ENV_ID || '',
    tcb: argValue(args, 'tcb') || process.env.CLOUDBASE_CLI || 'tcb',
    only: argList(args, 'only'),
    detect: flag('detect'),
    apply: flag('apply'),
    yes: flag('yes'),
    remoteDeps: flag('remote-deps'),
  };
}

function run(cmd, args, cwd = root) {
  return spawnSync(cmd, args, { encoding: 'utf8', shell: true, cwd });
}

/** 环境 ID 获取：`tcb env list --json` 解析候选，只打印不自动选（见 cloudbase-env.js）。 */
function detectEnvs(tcb) {
  process.exit(printEnvIds(tcb, run));
}

function preflight() {
  process.stdout.write([
    `【集合前置】以下 ${COLLECTIONS.length} 个集合必须已在控制台建好且权限为「所有用户不可读写」，缺一个就会在事务里报错：`,
    `  ${COLLECTIONS.join('、')}`,
    '  ad_daily / sync_pending / habitat_state / habitat_claims 是铸币与结算的硬前置。',
    '  另需在 config 集合发布 {configKey:"cases", status:"active"}，否则 syncCaseResult 恒返回 2002。',
    '  login 的环境变量 SESSION_SECRET 必须已配置，否则全链路 1001。',
    '',
  ].join('\n') + '\n');
}

function main() {
  const opt = argv();
  const names = opt.only.length ? DEPLOY_ORDER.filter((n) => opt.only.includes(n)) : DEPLOY_ORDER;
  if (opt.detect) detectEnvs(opt.tcb);
  if (!opt.env) {
    process.stdout.write('缺少 --env <云环境ID>（或 CLOUD_ENV_ID）。不确定就先跑：node scripts/deploy-all-cloud.js --detect\n');
    process.exit(2);
  }

  const probe = run(opt.tcb, ['--version']);
  if (probe.status !== 0) {
    process.stdout.write(`找不到 cloudbase-cli（${opt.tcb}）。装法：npm i -g @cloudbase/cli，然后 tcb login；或用 --tcb 指定可执行文件。\n`);
    process.exit(2);
  }

  process.stdout.write(`云环境：${opt.env}\nCLI：${opt.tcb} ${String(probe.stdout || '').trim().split('\n')[0]}\n函数：${names.length} 个（依赖顺序）\n依赖：${opt.remoteDeps ? '云端安装（--install-dependency true）' : '本地 npm install --omit=dev'}\n\n`);
  preflight();

  // 本 CLI 的 `fn deploy` 没有 -e/--env-id 参数，环境由全局默认（tcb env use）或 cloudbaserc.json 决定。
  const envUse = [opt.tcb, 'env', 'use', opt.env];
  const plan = names.map((name) => {
    const info = inspectFunction(fnRoot, name);
    const deploy = [opt.tcb, 'fn', 'deploy', name, '--dir', info.dir,
      '--install-dependency', opt.remoteDeps ? 'true' : 'false', '--force'];
    return { name, dir: info.dir, problems: info.problems, deploy,
      needsInstall: !opt.remoteDeps && !fs.existsSync(path.join(info.dir, 'node_modules')) };
  });

  const blocked = plan.filter((item) => item.problems.length);
  process.stdout.write('【本地自检】\n');
  plan.forEach((item) => {
    const mark = item.problems.length ? 'FAIL' : ' OK ';
    process.stdout.write(`  [${mark}] ${item.name}${item.problems.length ? ` — ${item.problems.join('；')}` : ''}\n`);
  });
  if (blocked.length) {
    process.stdout.write(`\n${blocked.length} 个函数未就绪，先跑 npm run build:cloud 再重跑本脚本。\n`);
    process.exit(1);
  }

  const show = (cmd) => cmd.map((p) => (/^[\w./:-]+$/.test(p) ? p : `"${p}"`)).join(' ');
  process.stdout.write('\n【执行序列】（先切默认环境，再逐函数：装依赖 → 部署；npm install 在函数目录内跑）\n');
  process.stdout.write(`  0. ${show(envUse)}\n`);
  plan.forEach((item, idx) => {
    process.stdout.write(`  ${idx + 1}. ${item.name}\n`);
    if (item.needsInstall) process.stdout.write(`       cd "${item.dir}" && npm install --omit=dev\n`);
    process.stdout.write(`       ${show(item.deploy)}\n`);
  });

  if (!opt.apply) {
    process.stdout.write('\n（dry-run，未执行任何部署。加 --apply 才会调用 CLI。）\n');
    return;
  }
  if (!opt.yes) {
    process.stdout.write('\n--apply 会向云端上传并覆盖这 13 个函数。加 --yes 确认后继续。\n');
    process.exit(2);
  }

  process.stdout.write(`\n→ 切默认环境：${show(envUse)}\n`);
  const use = run(envUse[0], envUse.slice(1));
  process.stdout.write(use.stdout || '');
  if (use.status !== 0) {
    process.stderr.write(use.stderr || '');
    process.stdout.write(`环境切换失败（退出码 ${use.status}），未部署任何函数。登录态问题跑 tcb login。\n`);
    process.exit(1);
  }

  // 任一步非零立即中止：函数之间有依赖，半套部署会让线上比不部署更糟。
  for (const item of plan) {
    const job = [{ cmd: ['npm', 'install', '--omit=dev'], cwd: item.dir }, { cmd: item.deploy, cwd: root }];
    if (!item.needsInstall) job.shift();
    for (const step of job) {
      process.stdout.write(`\n→ ${item.name}：${show(step.cmd)}\n`);
      const res = run(step.cmd[0], step.cmd.slice(1), step.cwd);
      process.stdout.write(res.stdout || '');
      process.stderr.write(res.stderr || '');
      if (res.status !== 0) {
        process.stdout.write(`${item.name} 这一步失败（退出码 ${res.status}），后续未执行。登录态问题跑 tcb login。\n`);
        process.exit(1);
      }
    }
  }

  process.stdout.write('\n全部函数部署完成。CLI 不创建定时触发器，还需人工补做：\n');
  TRIGGER_FUNCTIONS.forEach((name) => {
    process.stdout.write(`  · ${name}：在云开发控制台给该函数新建 timer 触发器（config.json 已写每日 09:00）。\n`);
  });
  process.stdout.write('  · login：复核 SESSION_SECRET 仍在（控制台改函数配置时可能被清掉）。\n');
}

main();
