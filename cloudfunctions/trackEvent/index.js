// GENERATED from index.ts by npm run build -- do not edit
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
// STATUS: implemented, W8 埋点批量落库（_id=openid:batchId 幂等 + 事件名/属性白名单裁剪）
// API: trackEvent, see docs/plan/接口冻结清单.md §2.11
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database({ throwOnNotFound: false });
const MAX_EVENTS = 60;
const MAX_PROPS = 8;
const MAX_VALUE_LENGTH = 64;
const EVENT_NAME = /^[A-Za-z0-9_]{1,40}$/;
const PROP_NAME = /^[A-Za-z0-9_]{1,24}$/;
function ok(data) {
    return { code: 0, msg: 'ok', data, serverTime: Date.now() };
}
function fail(code, msg) {
    return { code, msg, data: null, serverTime: Date.now() };
}
/** 以北京时间（UTC+8）切日，与 assist / adEvent 保持一致。 */
function shanghaiDate(now) {
    return new Date(now + 8 * 3600 * 1000).toISOString().slice(0, 10);
}
function cleanValue(value) {
    if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) {
        return value;
    }
    if (typeof value !== 'string') {
        return null;
    }
    return value.length > MAX_VALUE_LENGTH ? value.slice(0, MAX_VALUE_LENGTH) : value;
}
function cleanProps(raw) {
    if (!raw || typeof raw !== 'object') {
        return {};
    }
    const source = raw;
    const props = {};
    for (const key of Object.keys(source).slice(0, MAX_PROPS)) {
        if (!PROP_NAME.test(key)) {
            continue;
        }
        const value = cleanValue(source[key]);
        if (value !== null) {
            props[key] = value;
        }
    }
    return props;
}
function cleanEvent(raw) {
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    const item = raw;
    if (typeof item.event !== 'string' || !EVENT_NAME.test(item.event)) {
        return null;
    }
    const at = typeof item.at === 'number' && Number.isFinite(item.at) ? item.at : 0;
    return { event: item.event, props: cleanProps(item.props), at };
}
async function main(event) {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) {
        return fail(1001, 'SESSION_INVALID');
    }
    const batchId = event.batchId;
    if (typeof batchId !== 'string' || batchId.length === 0 || batchId.length > 64) {
        return fail(1002, 'INVALID_PARAM');
    }
    if (!Array.isArray(event.events) || event.events.length === 0 || event.events.length > MAX_EVENTS) {
        return fail(1002, 'INVALID_PARAM');
    }
    const events = event.events.map(cleanEvent).filter((item) => item !== null);
    if (events.length === 0) {
        return fail(1002, 'INVALID_PARAM');
    }
    const now = Date.now();
    const docId = `${OPENID}:${batchId}`;
    const batches = db.collection('track_events');
    const row = {
        openid: OPENID,
        batchId,
        events,
        count: events.length,
        platformDate: shanghaiDate(now),
        createdAt: now,
    };
    // 同一批次重复上报走主键冲突，直接返回首次落库的条数，不重复计入。
    try {
        await batches.add({ data: { _id: docId, ...row } });
    }
    catch (error) {
        const existing = await batches.doc(docId).get();
        if (existing.data && typeof existing.data.count === 'number') {
            return ok({ accepted: existing.data.count });
        }
        throw error;
    }
    return ok({ accepted: events.length });
}
