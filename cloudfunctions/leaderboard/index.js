// GENERATED from index.ts by npm run build -- do not edit
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
// STATUS: scaffold, API frozen by architect on 2026-10-29
// API: leaderboard, see docs/plan/接口冻结清单.md §2.5
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const LEADERBOARD_TYPES = ['reputation', 'collection', 'weekly'];
function ok(data) {
    return { code: 0, msg: 'ok', data, serverTime: Date.now() };
}
function fail(code, msg) {
    return { code, msg, data: null, serverTime: Date.now() };
}
async function main(event) {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) {
        return fail(1001, 'SESSION_INVALID');
    }
    const type = event.type;
    if (typeof type !== 'string' || !LEADERBOARD_TYPES.includes(type)) {
        return fail(1002, 'INVALID_PARAM');
    }
    if (event.period !== undefined && typeof event.period !== 'string') {
        return fail(1002, 'INVALID_PARAM');
    }
    const limit = event.limit;
    if (limit !== undefined && (typeof limit !== 'number' || limit < 1 || limit > 100)) {
        return fail(1002, 'INVALID_PARAM');
    }
    // W2: 查询 leaderboard 的 type + period + score 组合索引，返回前 N 与自己的名次；
    // 不返回 openid 明文，displayId 需脱敏。
    return ok({ entries: [], self: null });
}
