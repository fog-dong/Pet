// GENERATED from index.ts by npm run build -- do not edit
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
// STATUS: implemented, W8 好友助力（主键插入去重 + 单文档 inc 原子计数 + 超限回滚）
// API: assist, see docs/plan/接口冻结清单.md §2.6
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database({ throwOnNotFound: false });
const RESOURCE_TYPES = ['medicine', 'bed', 'heart'];
/** 06 §6.2：被助力方每日上限 5 次。 */
const TARGET_DAILY_LIMIT = 5;
const ASSIST_LIMIT_CODE = 1005;
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
function result(granted, reason, dailyCount) {
    return { granted, assisted: granted, reason, dailyCount, resources: null };
}
async function readDaily(dailyId) {
    const doc = await db.collection('assist_daily').doc(dailyId).get();
    return doc.data && typeof doc.data.count === 'number' ? doc.data.count : 0;
}
/** update + inc 对已存在文档是原子的；首次没有文档时补建一次再累加。 */
async function bumpDaily(dailyId, targetId, date) {
    const daily = db.collection('assist_daily');
    const first = await daily.doc(dailyId).update({
        data: { count: db.command.inc(1), updatedAt: Date.now() },
    });
    if (first.stats.updated > 0) {
        return;
    }
    try {
        await daily.add({
            data: { _id: dailyId, targetId, date, count: 0, createdAt: Date.now() },
        });
    }
    catch {
        // 并发首次创建：另一个请求已插入计数文档，继续累加即可。
    }
    const retry = await daily.doc(dailyId).update({
        data: { count: db.command.inc(1), updatedAt: Date.now() },
    });
    if (retry.stats.updated === 0) {
        throw new Error('ASSIST_COUNTER_UNAVAILABLE');
    }
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
    const targetId = OPENID;
    const date = shanghaiDate(Date.now());
    const dailyId = `${targetId}_${date}`;
    const pairId = `${targetId}_${helperId}_${date}`;
    const pairs = db.collection('assist_pairs');
    // 第一步：用自定义 _id 插入去重记录，主键冲突即“今日已助力”，不做先查后写。
    try {
        await pairs.add({
            data: { _id: pairId, targetId, helperId, date, resourceType, nonce, createdAt: Date.now() },
        });
    }
    catch (error) {
        const existing = await pairs.doc(pairId).get();
        if (existing.data) {
            return ok(result(false, 'ALREADY_ASSISTED', await readDaily(dailyId)));
        }
        throw error;
    }
    // 第二步：单文档 inc 计数；第三步：超过上限删除刚插入的去重记录并回退计数。
    try {
        await bumpDaily(dailyId, targetId, date);
        const dailyCount = await readDaily(dailyId);
        if (dailyCount > TARGET_DAILY_LIMIT) {
            await pairs.doc(pairId).remove();
            await db.collection('assist_daily').doc(dailyId).update({
                data: { count: db.command.inc(-1), updatedAt: Date.now() },
            });
            return fail(ASSIST_LIMIT_CODE, 'TODAY_ASSIST_LIMIT');
        }
        return ok(result(true, null, dailyCount));
    }
    catch (error) {
        await pairs.doc(pairId).remove().catch(() => undefined);
        throw error;
    }
}
