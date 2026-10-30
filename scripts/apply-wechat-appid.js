'use strict';
// 把正式 AppID 注入小游戏构建产物：AppID 只存在本机（被 .gitignore 忽略的 project.config.json 或环境变量），不入库。
// 用法：npm run wx:appid [-- 构建产物目录]，默认 build/wechatgame-release。

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const targetDir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'build', 'wechatgame-release');
const localConfig = path.join(root, 'project.config.json');

function readLocalAppid() {
  if (!fs.existsSync(localConfig)) {
    return '';
  }
  try {
    return JSON.parse(fs.readFileSync(localConfig, 'utf8')).appid || '';
  } catch {
    return '';
  }
}

const appid = process.env.WX_APPID || readLocalAppid();
if (!/^wx[0-9a-f]{16}$/.test(appid)) {
  throw new Error('缺少正式 AppID：设置 WX_APPID 环境变量，或在项目根 project.config.json 里填写 appid');
}

const file = path.join(targetDir, 'project.config.json');
if (!fs.existsSync(file)) {
  throw new Error(`未找到构建产物的 project.config.json：${file}`);
}

const config = JSON.parse(fs.readFileSync(file, 'utf8'));
config.appid = appid;
fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
process.stdout.write(`appid applied to ${path.relative(root, file)}\n`);
