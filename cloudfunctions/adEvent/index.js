// GENERATED from index.ts by npm run build -- do not edit
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
// STATUS: scaffold, API frozen by architect on 2026-10-29
// API: adEvent, see docs/plan/接口冻结清单.md §2.7
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
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
    const adSessionId = event.adSessionId;
    const adUnitId = event.adUnitId;
    const scene = event.scene;
    if (typeof adSessionId !== 'string' || adSessionId.length === 0) {
        return fail(1002, 'INVALID_PARAM');
    }
    if (typeof adUnitId !== 'string' || adUnitId.length === 0) {
        return fail(1002, 'INVALID_PARAM');
    }
    if (typeof scene !== 'string' || scene.length === 0) {
        return fail(1002, 'INVALID_PARAM');
    }
    if (typeof event.isEnded !== 'boolean') {
        return fail(1002, 'INVALID_PARAM');
    }
    if (!event.isEnded) {
        return ok({ granted: false, reward: null, todayCount: 0 });
    }
    // W2: 校验 idempotencyKey（openid:adSessionId）唯一索引与广告位白名单；
    // 按每日上限发奖，返回最新计数。W1 不接真实广告，不写库、不发奖。
    return ok({ granted: false, reward: null, todayCount: 0 });
}
