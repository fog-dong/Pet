// GENERATED from index.ts by npm run build -- do not edit
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
// STATUS: scaffold, API frozen by architect on 2026-10-29
// API: payCallback, see docs/plan/接口冻结清单.md §2.9
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
function fail(code, msg) {
    return { code, msg, data: null, serverTime: Date.now() };
}
async function main(event) {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) {
        return fail(1001, 'SESSION_INVALID');
    }
    const payload = event.platformPayload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return fail(1002, 'INVALID_PARAM');
    }
    // F1 冻结：W1-W4 不验真实平台报文、不发货、不更新订单。
    return fail(3002, 'PAY_UNAVAILABLE');
}
