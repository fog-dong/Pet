// GENERATED from index.ts by npm run build -- do not edit
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
// STATUS: implemented, W11-1 好友助力（事务内去重 + 计数 + 超限判定，不再使用 inc + 回退）；W12-1 补事务重试耗尽失败码
// API: assist, see docs/plan/接口冻结清单.md §2.6
const cloud = require("wx-server-sdk");
const settle_1 = require("./settle");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const RESOURCE_TYPES = ['medicine', 'bed', 'heart'];
/** 06 §6.2：被助力方每日上限 5 次。 */
const TARGET_DAILY_LIMIT = 5;
const ASSIST_LIMIT_CODE = 1005;
/** 事务冲突重试耗尽：可安全重试，客户端按补发队列下次再发。 */
const RETRY_EXHAUSTED_CODE = 1006;
/**
 * SDK 只对事务冲突自动重试（默认 3 次，见 settle.ts），耗尽后抛出的仍是冲突类错误。
 * 其余异常（权限、网络、参数）不上报 1006，原样上抛交给平台日志与客户端重试。
 */
function isTransactionConflict(error) {
    const source = error;
    const markers = [source.errCode, source.code, source.message]
        .filter((value) => typeof value === 'string')
        .join(' ')
        .toUpperCase();
    return markers.includes('CONFLICT') || markers.includes('TRANSACTION');
}
function ok(data) {
    return { code: 0, msg: 'ok', data, serverTime: Date.now() };
}
function fail(code, msg) {
    return { code, msg, data: null, serverTime: Date.now() };
}
/** 以北京时间（UTC+8）切日，避免跨时区重复计数。 */
function shanghaiDate(now) {
    return new Date(now + 8 * 3600 * 1000).toISOString().slice(0, 10);
}
async function main(event) {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) {
        return fail(1001, 'SESSION_INVALID');
    }
    const helperId = event.friendOpenid;
    if (typeof helperId !== 'string' || helperId.length === 0 || helperId === OPENID) {
        return fail(1002, 'INVALID_PARAM');
    }
    const resourceType = event.resourceType === undefined ? 'heart' : event.resourceType;
    if (typeof resourceType !== 'string' || !RESOURCE_TYPES.includes(resourceType)) {
        return fail(1002, 'INVALID_PARAM');
    }
    const nonce = event.nonce;
    if (typeof nonce !== 'string' || nonce.length === 0) {
        return fail(1002, 'INVALID_PARAM');
    }
    const now = Date.now();
    const targetId = OPENID;
    const date = shanghaiDate(now);
    // 去重、额度判定、计数与 pair 落库都在 settleAssist 的事务里一次完成，这里只负责校验与结果映射。
    let outcome;
    try {
        outcome = await (0, settle_1.settleAssist)({
            pairId: `${targetId}_${helperId}_${date}`,
            dailyId: `${targetId}_${date}`,
            targetId,
            helperId,
            date,
            resourceType,
            nonce,
            limit: TARGET_DAILY_LIMIT,
            now,
        });
    }
    catch (error) {
        if (isTransactionConflict(error)) {
            return fail(RETRY_EXHAUSTED_CODE, 'TRANSACTION_RETRY_EXHAUSTED');
        }
        throw error;
    }
    if (outcome.reason === 'LIMIT') {
        return fail(ASSIST_LIMIT_CODE, 'TODAY_ASSIST_LIMIT');
    }
    return ok({
        granted: outcome.granted,
        assisted: outcome.granted,
        reason: outcome.reason,
        dailyCount: outcome.dailyCount,
        resources: null,
    });
}
