// GENERATED from index.ts by npm run build -- do not edit
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
// STATUS: scaffold, API frozen by architect on 2026-10-29
// API: getProfile, see docs/plan/接口冻结清单.md §2.2
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
function ok(data) {
    return { code: 0, msg: 'ok', data, serverTime: Date.now() };
}
function fail(code, msg) {
    return { code, msg, data: null, serverTime: Date.now() };
}
async function main() {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) {
        return fail(1001, 'SESSION_INVALID');
    }
    // W2: 汇总 users / hospital_state / pets / adoptions；W1 返回空结构，不伪造数据。
    return ok({ user: null, hospital: null, resources: null, collection: null });
}
