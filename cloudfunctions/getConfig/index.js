// GENERATED from index.ts by npm run build -- do not edit
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
// STATUS: implemented
// API: getConfig, see docs/plan/接口冻结清单.md §2.10
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
// 与 docs/plan/数据库初始化清单.md §5 的配置种子一致；quality 为 W15-3 补入（画质远程开关）。
const CONFIG_KEYS = ['cases', 'skus', 'ad_slots', 'activities', 'affection', 'collection', 'quality'];
const MAX_CONFIG_DOCS = 100;
function ok(data) {
    return { code: 0, msg: 'ok', data, serverTime: Date.now() };
}
function fail(code, msg) {
    return { code, msg, data: null, serverTime: Date.now() };
}
function bucketOf(openid) {
    let hash = 0;
    for (let index = 0; index < openid.length; index += 1) {
        hash = (hash * 31 + openid.charCodeAt(index)) % 100;
    }
    return hash;
}
function isEligible(doc, tags, openid) {
    const grayTags = Array.isArray(doc.grayTags) ? doc.grayTags : [];
    const percent = typeof doc.grayPercent === 'number' ? doc.grayPercent : 0;
    if (grayTags.length === 0) {
        return percent >= 100;
    }
    if (grayTags.some((tag) => tags.has(tag))) {
        return true;
    }
    return bucketOf(openid) < percent;
}
function readTags(raw) {
    if (raw === undefined) {
        return [];
    }
    if (!Array.isArray(raw)) {
        return null;
    }
    const tags = [];
    for (const tag of raw) {
        if (typeof tag !== 'string') {
            return null;
        }
        tags.push(tag);
    }
    return tags;
}
function pickLatest(docs) {
    const latest = new Map();
    for (const doc of docs) {
        const key = doc.configKey;
        if (typeof key !== 'string' || !CONFIG_KEYS.includes(key)) {
            continue;
        }
        const previous = latest.get(key);
        if (!previous || (doc.version ?? -1) > (previous.version ?? -1)) {
            latest.set(key, doc);
        }
    }
    return latest;
}
async function main(event) {
    if (event.version !== undefined && (typeof event.version !== 'number' || !Number.isInteger(event.version) || event.version < 0)) {
        return fail(1002, 'INVALID_PARAM');
    }
    const tags = readTags(event.grayTags);
    if (!tags) {
        return fail(1002, 'INVALID_PARAM');
    }
    const { OPENID } = cloud.getWXContext();
    const result = await cloud
        .database()
        .collection('config')
        .where({ status: 'active' })
        .limit(MAX_CONFIG_DOCS)
        .get();
    const latest = pickLatest(result.data);
    let version = 0;
    for (const doc of latest.values()) {
        version = Math.max(version, doc.version ?? 0);
    }
    if (typeof event.version === 'number' && event.version === version) {
        return ok({ version, configs: {}, forceUpdate: false, minVersion: '0.0.0' });
    }
    const tagSet = new Set(tags);
    const configs = {};
    for (const [key, doc] of latest) {
        if (isEligible(doc, tagSet, OPENID ?? '')) {
            configs[key] = doc.payload ?? null;
        }
    }
    // minVersion/forceUpdate 依赖运营配置，当前无 active 配置源，返回安全默认值。
    return ok({ version, configs, forceUpdate: false, minVersion: '0.0.0' });
}
