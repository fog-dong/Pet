'use strict';
// 给 tsc 产物加首行标记，区分 .ts 源码与 .js 产物，避免手改产物。

const fs = require('fs');
const path = require('path');

const banner = (name) => `// GENERATED from ${name}.ts by npm run build -- do not edit`;
const MIN_FUNCTIONS = 10;
const root = path.join(__dirname, '..', 'cloudfunctions');

const dirs = fs.readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory());
let functions = 0;
let files = 0;

// 函数目录里的每个 .js 都是构建产物（`adEvent` 除 index.js 还有 settle.js），部署上传整个目录，缺标记就会被手改。
for (const dir of dirs) {
  const dirPath = path.join(root, dir.name);
  const jsFiles = fs.readdirSync(dirPath).filter((name) => name.endsWith('.js'));
  if (!jsFiles.includes('index.js')) {
    continue;
  }
  for (const name of jsFiles) {
    const file = path.join(dirPath, name);
    const body = fs.readFileSync(file, 'utf8').replace(/^\/\/ GENERATED[^\n]*\n/, '');
    fs.writeFileSync(file, `${banner(path.basename(name, '.js'))}\n${body}`);
    files += 1;
  }
  functions += 1;
}

if (functions < MIN_FUNCTIONS) {
  throw new Error(`stamped ${functions} functions, expected at least ${MIN_FUNCTIONS}`);
}

process.stdout.write(`stamped ${files} files across ${functions} cloud function builds\n`);
