'use strict';
// 给 tsc 产物加首行标记，区分 index.ts 源码与 index.js 产物，避免手改产物。

const fs = require('fs');
const path = require('path');

const BANNER = '// GENERATED from index.ts by npm run build -- do not edit';
const MIN_FUNCTIONS = 10;
const root = path.join(__dirname, '..', 'cloudfunctions');

const dirs = fs.readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory());
let stamped = 0;

for (const dir of dirs) {
  const file = path.join(root, dir.name, 'index.js');
  if (!fs.existsSync(file)) {
    continue;
  }
  const body = fs.readFileSync(file, 'utf8').replace(/^\/\/ GENERATED[^\n]*\n/, '');
  fs.writeFileSync(file, `${BANNER}\n${body}`);
  stamped += 1;
}

if (stamped < MIN_FUNCTIONS) {
  throw new Error(`stamped ${stamped} functions, expected at least ${MIN_FUNCTIONS}`);
}

process.stdout.write(`stamped ${stamped} cloud function builds\n`);
