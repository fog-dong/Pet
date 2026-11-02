// STATUS: implemented, W20-4 模块三 浏览器核验前置静态服务（仅本地，不部署）
'use strict';
// 用法：node scripts/serve-web.js <站点目录> [端口]
// 给 CDP 自动化脚本（verify-mainchain-browser.js / verify-habitat-browser.js）提供 http 源，
// 因为 localStorage 与 WebGL 在 file:// 下不可用。

const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || 'build/web-mobile');
const PORT = Number(process.argv[3] || 8095);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.wasm': 'application/wasm',
  '.pkm': 'application/octet-stream',
  '.abp': 'application/octet-stream',
  '.mp3': 'audio/mpeg',
  '.ttf': 'font/ttf',
};

if (!fs.existsSync(ROOT)) {
  console.error(`站点目录不存在：${ROOT}（先跑 npm run build:wechat -- --platform=web-mobile）`);
  process.exit(1);
}

http
  .createServer((req, res) => {
    const rel = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, '127.0.0.1', () => console.log(`serving ${ROOT} on ${PORT}`));
