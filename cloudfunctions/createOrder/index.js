// GENERATED from index.ts by npm run build -- do not edit
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
// STATUS: scaffold, API frozen by architect on 2026-10-29
// API: createOrder, see docs/plan/接口冻结清单.md §2.8
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
    const skuId = event.skuId;
    const clientOrderId = event.clientOrderId;
    if (typeof skuId !== 'string' || skuId.length === 0) {
        return fail(1002, 'INVALID_PARAM');
    }
    if (typeof clientOrderId !== 'string' || clientOrderId.length === 0) {
        return fail(1002, 'INVALID_PARAM');
    }
    // F1 冻结：W1-W4 不创建真实订单、不调用统一下单、不返回支付参数。
    return fail(3002, 'PAY_UNAVAILABLE');
}
