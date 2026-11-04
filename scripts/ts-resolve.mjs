// STATUS: implemented, W25 回归脚本的 TS 解析钩子（--experimental-strip-types 不解析无扩展名相对导入）
import { register } from 'node:module';

register('./ts-resolve-hooks.mjs', import.meta.url);
