'use strict';
// STATUS: implemented, W21-7 cloudbase-cli 环境 ID 获取
// 只负责一件事：向 tcb 要当前账号可见的云环境 ID，供 deploy-all-cloud.js 的 --detect 使用。
// 解析口径：优先 `tcb env list --json` 递归收集所有 *envId* 字段；JSON 不可用时退回按行的形状匹配。

/** 递归收集对象/数组里所有形如 envId 的字符串值。 */
function collectEnvIds(node, out) {
  if (Array.isArray(node)) node.forEach((item) => collectEnvIds(item, out));
  else if (node && typeof node === 'object') {
    Object.entries(node).forEach(([key, value]) => {
      // 只认字段名就是环境 ID 的键，避免把 nextEnvId 这类游标值当成候选。
      if (/^(env|environment)[_]?id$/i.test(key) && typeof value === 'string') out.add(value);
      else collectEnvIds(value, out);
    });
  }
  return out;
}

function parseIds(stdout, stderr) {
  try {
    const json = JSON.parse(stdout);
    if (json && json.error) {
      const hint = Array.isArray(json.error.solution) ? json.error.solution.join(' / ') : '';
      return { ids: [], message: `CLI 返回错误：${json.error.message}${hint ? `（处理建议：${hint}）` : ''}` };
    }
    return { ids: [...collectEnvIds(json, new Set())] };
  } catch {
    const text = `${stdout}${stderr}`;
    return { ids: [...new Set((text.match(/\b[a-z0-9][a-z0-9_-]*-[a-z0-9]{6,24}\b/gi) || []))] };
  }
}

/** 打印候选环境 ID（不自动选：填错环境会把函数传到别人的环境上）。返回退出码。 */
function printEnvIds(tcb, run) {
  const res = run(tcb, ['env', 'list', '--json']);
  const text = `${res.stdout || ''}${res.stderr || ''}`.trim();
  const parsed = parseIds(res.stdout || '', res.stderr || '');
  if (text) process.stdout.write(`${text}\n`);
  if (parsed.message) {
    process.stdout.write(`${parsed.message}\n`);
    return 2;
  }
  // 非零退出且不是可解析的 CLI 错误：多半是没装/没登录，别把命令行噪音当成环境 ID。
  if (res.error || res.status !== 0) {
    process.stdout.write(`\`tcb env list\` 调用失败（退出码 ${res.status}）。先 npm i -g @cloudbase/cli，再 tcb login。\n`);
    return 2;
  }
  process.stdout.write(`—— 解析到 ${parsed.ids.length} 个候选环境 ID：\n`);
  parsed.ids.forEach((id) => process.stdout.write(`  · ${id}\n`));
  if (!parsed.ids.length) process.stdout.write('  （解析不到就从上面输出里手动复制环境 ID 填给 --env）\n');
  return parsed.ids.length ? 0 : 2;
}

module.exports = { printEnvIds, collectEnvIds };
