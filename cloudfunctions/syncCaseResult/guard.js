// GENERATED from guard.ts by npm run build -- do not edit
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPlain = isPlain;
exports.isInt = isInt;
exports.toCount = toCount;
// STATUS: implemented, W12-3 入参与配置的窄化工具（不信任客户端字段类型）
function isPlain(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isInt(value, min, max) {
    return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}
function toCount(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}
