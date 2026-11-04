// GENERATED from index.ts by npm run build -- do not edit
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
// STATUS: implemented
// API: saveGame, see docs/plan/接口冻结清单.md §2.3
const cloud = require("wx-server-sdk");
const validate_1 = require("./validate");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
function ok(data) {
    return { code: 0, msg: 'ok', data, serverTime: Date.now() };
}
function fail(code, msg) {
    return { code, msg, data: null, serverTime: Date.now() };
}
function conflict(data) {
    return { code: 1004, msg: 'DUPLICATE', data, serverTime: Date.now() };
}
async function main(event) {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) {
        return fail(1001, 'SESSION_INVALID');
    }
    const revision = event.revision;
    if (!(0, validate_1.isNonNegativeInt)(revision) || revision < 1) {
        return fail(1002, 'INVALID_PARAM');
    }
    if (!(0, validate_1.isPlainObject)(event.snapshot)) {
        return fail(1002, 'INVALID_PARAM');
    }
    const patch = (0, validate_1.readSnapshot)(event.snapshot);
    if (!patch) {
        return fail(1002, 'INVALID_PARAM');
    }
    const now = Date.now();
    return cloud.database().runTransaction(async (transaction) => {
        const userRef = transaction.collection('users').doc(OPENID);
        const user = (await userRef.get()).data;
        if (!user) {
            return fail(1001, 'SESSION_INVALID');
        }
        const stateRef = transaction.collection('hospital_state').doc(OPENID);
        const state = (await stateRef.get()).data;
        const current = state && typeof state.revision === 'number' ? state.revision : 0;
        if (revision <= current) {
            return conflict({ revision: current, serverTime: now });
        }
        const statePatch = { ...patch.state, openid: OPENID, revision, updatedAt: now };
        if (state) {
            await stateRef.update({ data: statePatch });
        }
        else {
            await stateRef.set({ data: statePatch });
        }
        // W15-1：users.resources 只由 syncCaseResult 在事务内按服务端配置入账。
        // 客户端快照里的 resources 一律忽略：否则改本地存档即可直接改云端金币/爱心（W12-B 同源）。
        // reputation 是唯一被放行的例外：10 §3.2 标注 hospital_state.reputation「与 users 同步」，
        // getProfile 两处都在读它，所以同事务镜像一次，避免两个口径长期分叉。
        const userPatch = { revision };
        if (typeof patch.state.reputation === 'number') {
            userPatch.reputation = patch.state.reputation;
        }
        await userRef.update({ data: userPatch });
        return ok({ revision, serverTime: now });
    });
}
