// GENERATED from index.ts by npm run build -- do not edit
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
// STATUS: implemented, W12-3 服务端结算（配置驱动重算 + 事务幂等发奖）
// API: syncCaseResult, see docs/plan/接口冻结清单.md §2.4
const cloud = require("wx-server-sdk");
const cases_1 = require("./cases");
const guard_1 = require("./guard");
const settle_1 = require("./settle");
const validate_1 = require("./validate");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const MAX_ID_LENGTH = 64;
const MAX_DURATION_MS = 24 * 3600 * 1000;
const MAX_CONFIG_DOCS = 100;
/** 事务冲突重试耗尽：可安全重试，客户端按补发队列下次再发。 */
const RETRY_EXHAUSTED_CODE = 1006;
const INVALID_STATE_CODE = 2002;
function ok(data) {
    return { code: 0, msg: 'ok', data, serverTime: Date.now() };
}
function fail(code, msg) {
    return { code, msg, data: null, serverTime: Date.now() };
}
/**
 * SDK 只对事务冲突自动重试（默认 3 次），耗尽后抛出的仍是冲突类错误。
 * 其余异常（权限、网络）不上报 1006，原样上抛交给平台日志与客户端重试。
 */
function isTransactionConflict(error) {
    const source = error;
    const markers = [source.errCode, source.code, source.message]
        .filter((value) => typeof value === 'string')
        .join(' ')
        .toUpperCase();
    return markers.includes('CONFLICT') || markers.includes('TRANSACTION');
}
/** 与 getConfig 同口径：`config` 集合取 `configKey='cases'` 的最高 active 版本。 */
async function loadCaseCatalog() {
    const result = await cloud
        .database()
        .collection('config')
        .where({ status: 'active' })
        .limit(MAX_CONFIG_DOCS)
        .get();
    let latest = null;
    for (const doc of result.data) {
        if (doc.configKey !== 'cases') {
            continue;
        }
        if (!latest || (doc.version ?? -1) > (latest.version ?? -1)) {
            latest = doc;
        }
    }
    return latest ? (0, cases_1.readCaseCatalog)(latest.payload) : null;
}
async function main(event) {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) {
        return fail(1001, 'SESSION_INVALID');
    }
    const { caseSessionId, caseId, durationMs } = event;
    if (typeof caseSessionId !== 'string' || caseSessionId.length === 0 || caseSessionId.length > MAX_ID_LENGTH) {
        return fail(1002, 'INVALID_PARAM');
    }
    if (typeof caseId !== 'string' || caseId.length === 0 || caseId.length > MAX_ID_LENGTH) {
        return fail(1002, 'INVALID_PARAM');
    }
    const diagnosis = (0, validate_1.readDiagnosis)(event.diagnosis);
    const treatment = (0, validate_1.readTreatment)(event.treatment);
    if (!diagnosis || !treatment || !(0, guard_1.isInt)(durationMs, 0, MAX_DURATION_MS)) {
        return fail(1002, 'INVALID_PARAM');
    }
    const item = (await loadCaseCatalog())?.get(caseId);
    if (!item) {
        // 配置未发布或病例不存在：不按客户端数值兜底发奖。
        return fail(INVALID_STATE_CODE, 'INVALID_STATE');
    }
    try {
        const outcome = await (0, settle_1.settleCaseResult)({
            openid: OPENID,
            caseSessionId,
            caseId,
            diagnosis,
            treatment,
            durationMs,
            item,
            now: Date.now(),
        });
        if (!outcome) {
            return fail(1001, 'SESSION_INVALID');
        }
        return ok({
            result: outcome.result,
            rewards: outcome.rewards,
            resources: outcome.resources,
        });
    }
    catch (error) {
        if (isTransactionConflict(error)) {
            return fail(RETRY_EXHAUSTED_CODE, 'TRANSACTION_RETRY_EXHAUSTED');
        }
        throw error;
    }
}
