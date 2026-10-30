// GENERATED from index.ts by npm run build -- do not edit
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
// STATUS: implemented, W8 广告事件（_id=openid:adSessionId 幂等 + 自然日频控；isEnded=false 只记录）
// API: adEvent, see docs/plan/接口冻结清单.md §2.7
const cloud = require("wx-server-sdk");
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
function replay(doc) {
    return ok({
        granted: doc.granted === true,
        reward: null,
        todayCount: typeof doc.dailyCount === 'number' ? doc.dailyCount : 0,
    });
}
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
    const idempotencyKey = `${OPENID}:${adSessionId}`;
    const events = db.collection('ad_events');
    // 第一步：用 _id=幂等键插入；冲突即重复上报，返回首次写入的结果。
    const countEnded = await events.where({ openid: OPENID, platformDate, isEnded: true }).count();
    const endedToday = countEnded.total;
    const granted = event.isEnded && endedToday < (await dailyLimit(OPENID, now));
    const dailyCount = endedToday + (granted ? 1 : 0);
    const row = {
        idempotencyKey,
        openid: OPENID,
        adSessionId,
        adUnitId,
        scene,
        isEnded: event.isEnded,
        granted,
        reward: null,
        platformDate,
        dailyCount,
        createdAt: now,
        reconciled: false,
    };
    try {
        await events.add({ data: { _id: idempotencyKey, ...row } });
    }
    catch (error) {
        const existing = await events.doc(idempotencyKey).get();
        if (existing.data) {
            return replay(existing.data);
        }
        throw error;
    }
    return ok({ granted, reward: null, todayCount: dailyCount });
}
