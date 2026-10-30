'use strict';
// Cocos CLI 默认用编辑器当前打开的场景当启动场景，直接构建会落到单局场景（FSM 未初始化 → 黑屏）。
// 这里从 Boot.scene.meta 读 uuid 显式传给 startScene，构建后再补注入 AppID。
// 用法：npm run build:wechat [-- --platform=web-mobile --output=web-mobile-w16]

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const DEFAULT_CREATOR = 'C:/ProgramData/cocos/editors/Creator/3.8.0/CocosCreator.exe';
const creator = process.env.COCOS_CREATOR || DEFAULT_CREATOR;

function readBootUuid() {
  const metaPath = path.join(root, 'assets', 'scenes', 'Boot.scene.meta');
  const raw = fs.readFileSync(metaPath, 'utf8').replace(/^\uFEFF/, '');
  const uuid = JSON.parse(raw).uuid;
  if (!uuid) {
    throw new Error(`Boot.scene.meta 缺少 uuid：${metaPath}`);
  }
  return uuid;
}

function argValue(name, fallback) {
  const hit = process.argv.slice(2).find((item) => item.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const platform = argValue('platform', 'wechatgame');
const output = argValue('output', platform === 'wechatgame' ? 'wechatgame-release' : `${platform}-release`);
const uuid = readBootUuid();

if (!fs.existsSync(creator)) {
  throw new Error(`找不到 Cocos Creator：${creator}（可用 COCOS_CREATOR 环境变量指定）`);
}

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const result = spawnSync(
  creator,
  ['--project', root, '--build', `platform=${platform};debug=false;outputName=${output};startScene=${uuid}`],
  { env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');

const outDir = path.join(root, 'build', output);
const settingsPath = path.join(outDir, 'src', 'settings.json');
const settings = fs.existsSync(settingsPath)
  ? JSON.parse(fs.readFileSync(settingsPath, 'utf8').replace(/^\uFEFF/, ''))
  : null;
if (!settings || !settings.launch || settings.launch.launchScene !== 'db://assets/scenes/Boot.scene') {
  throw new Error(`构建未成功或启动场景不对：${settingsPath}`);
}

if (platform === 'wechatgame') {
  const appid = spawnSync(process.execPath, [path.join(__dirname, 'apply-wechat-appid.js'), outDir], {
    encoding: 'utf8',
  });
  if (appid.status === 0) {
    process.stdout.write(appid.stdout || '');
  } else {
    process.stdout.write(`appid 未注入（保留 touristappid）：${(appid.stderr || '').trim()}\n`);
  }
}

process.stdout.write(`build ok: ${output}, launchScene=Boot ${uuid}\n`);
