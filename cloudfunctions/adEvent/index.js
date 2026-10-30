// GENERATED from index.ts by npm run build -- do not edit
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
// STATUS: implemented, W10-5/W21 广告事件（_id=openid:adSessionId 幂等 + ad_daily 事务内原子频控；isEnded=false 只记录）；W12-1 补事务重试耗尽失败码
// API: adEvent, see docs/plan/接口冻结清单.md §2.7
const cloud = require("wx-server-sdk");
const settle_1 = require("./settle");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database({ throwOnNotFound: false });
/** 11 §4 广告位场景白名单；与客户端 AdConfig 保持一致。 */
const SCENES = [
    'extra_check',
    'extra_inspection',
    'accelerate',
    'double_reward',
    'free_slot',
    'extra_medicine',
    'extra_bed',
];
/** 11 §6：激励视频全局硬上限 10 次/日，新用户 24h 内 5 次。 */
const GLOBAL_DAILY_LIMIT = 10;
const NEW_USER_DAILY_LIMIT = 5;
const NEW_USER_WINDOW_MS = 24 * 60 * 60 * 1000;
const SESSION_ID_MAX = 64;
/** 事务冲突重试耗尽：可安全重试，客户端把该事件重新入补发队列。 */
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
/** 以北京时间（UTC+8）切日，与 assist 计数保持一致。 */
function shanghaiDate(now) {
    return new Date(now + 8 * 3600 * 1000).toISOString().slice(0, 10);
}
/** 新用户 24h 内限 5 次；`users` 缺档按老用户处理，与改造前一致。 */
async function dailyLimit(openid, now) {
    const user = await db.collection('users').doc(openid).get();
    const createdAt = user.data && typeof user.data.createdAt === 'number' ? user.data.createdAt : 0;
    return createdAt > 0 && now - createdAt < NEW_USER_WINDOW_MS ? NEW_USER_DAILY_LIMIT : GLOBAL_DAILY_LIMIT;
}
async function main(event) {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) {
        return fail(1001, 'SESSION_INVALID');
    }
    const adSessionId = event.adSessionId;
    const adUnitId = event.adUnitId;
    const scene = event.scene;
    if (typeof adSessionId !== 'string' || adSessionId.length === 0 || adSessionId.length > SESSION_ID_MAX) {
        return fail(1002, 'INVALID_PARAM');
    }
    if (typeof adUnitId !== 'string' || adUnitId.length === 0) {
        return fail(1002, 'INVALID_PARAM');
    }
    if (typeof scene !== 'string' || !SCENES.includes(scene)) {
        return fail(1002, 'INVALID_PARAM');
    }
    if (typeof event.isEnded !== 'boolean') {
        return fail(1002, 'INVALID_PARAM');
    }
    const now = Date.now();
    const platformDate = shanghaiDate(now);
    // 未看完的会话不占额度，上限无意义，省掉一次 `users` 读；0 只是让事务里的比较恒为假。
    const limit = event.isEnded ? await dailyLimit(OPENID, now) : 0;
    // 去重、占当日额度、写最终结论都在 settleAdEvent 的事务里一次完成，这里只负责校验与上限取值。
    let data;
    try {
        data = await (0, settle_1.settleAdEvent)({
            idempotencyKey: `${OPENID}:${adSessionId}`,
            dailyId: `${OPENID}_${platformDate}`,
            openid: OPENID,
            adSessionId,
            adUnitId,
            scene,
            isEnded: event.isEnded,
            platformDate,
            limit,
            now,
        });
    }
    catch (error) {
        if (isTransactionConflict(error)) {
            return fail(RETRY_EXHAUSTED_CODE, 'TRANSACTION_RETRY_EXHAUSTED');
        }
        throw error;
    }
    return ok(data);
}
