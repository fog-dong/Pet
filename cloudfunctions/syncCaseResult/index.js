// GENERATED from index.ts by npm run build -- do not edit
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
// STATUS: scaffold, API frozen by architect on 2026-10-29
// API: syncCaseResult, see docs/plan/接口冻结清单.md §2.4
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
    const caseSessionId = event.caseSessionId;
    const caseId = event.caseId;
    if (typeof caseSessionId !== 'string' || caseSessionId.length === 0) {
        return fail(1002, 'INVALID_PARAM');
    }
    if (typeof caseId !== 'string' || caseId.length === 0) {
        return fail(1002, 'INVALID_PARAM');
    }
    const diagnosis = event.diagnosis;
    const treatment = event.treatment;
    if (!diagnosis || typeof diagnosis !== 'object' || Array.isArray(diagnosis)) {
        return fail(1002, 'INVALID_PARAM');
    }
    if (!treatment || typeof treatment !== 'object' || Array.isArray(treatment)) {
        return fail(1002, 'INVALID_PARAM');
    }
    const durationMs = event.durationMs;
    if (typeof durationMs !== 'number' || durationMs < 0) {
        return fail(1002, 'INVALID_PARAM');
    }
    // W2 幂等占位：按 pets_cases.caseSessionId 唯一索引先查历史；已存在直接返回历史结果，
    // 不重复计算奖励。W1 不做结算、不写库，返回空结构。
    return ok({ result: null, rewards: null, resources: null });
}
