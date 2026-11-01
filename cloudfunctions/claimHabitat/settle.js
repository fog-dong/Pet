// GENERATED from settle.ts by npm run build -- do not edit
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimHabitatSettle = claimHabitatSettle;
// STATUS: scaffold, W20-2/任务四 小屋离线收益结算（事务内幂等 + 服务端计时 + users.resources 入账；未部署前客户端不调用）
// API: claimHabitat, see docs/plan/接口冻结清单.md §2.12
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database({ throwOnNotFound: false });
/** SDK 仅在事务冲突时自动重试，默认 3 次；命中上限后由 index.ts 映射成 1006。 */
const TRANSACTION_RETRIES = 3;
/** 每只领养宠物每整小时离线时长 4 金币（《W20 方案》§2.2）。 */
const COINS_PER_PET_HOUR = 4;
/**
 * 心情系数分档（≥70:1.2 / 40-69:1.0 / <40:0.5）需要小屋属性上云才能取到，
 * 而 D19 期间 `buildSaveSnapshot` 不转发 habitat 字段，所以骨架先按保守的 1.0 计价。
 */
const MOOD_FACTOR = 1;
/** 单次领取最多结算 6 小时：连点与长期不上线都不会放大产出。 */
const MAX_HOURS_PER_CLAIM = 6;
/** 每日最多 2 次领取（《W20 方案》§2.2 的日 2 次 ≈ 172 金币口径）。 */
const MAX_DAILY_CLAIMS = 2;
/** 服务端没有 `habitat_state` 档时，客户端 `lastClaimTime` 最多只能回溯到 6 小时前。 */
const MAX_LOOKBACK_MS = MAX_HOURS_PER_CLAIM * 3600 * 1000;
const HOUR_MS = 3600 * 1000;
function isPlain(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function toCount(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}
function resourceView(user) {
    return isPlain(user.resources) ? user.resources : {};
}
function outcome(status, hours, coins) {
    return { status, hours, coins };
}
/**
 * 幂等由「服务端自己的起算点」保证：事务内读 `habitat_state.lastClaimAt` 算出整小时数，
 * 连点第二下算到 hours=0，直接返回 0 金币且不占当日额度；首次铸币才在同一事务里把
 * `lastClaimAt` 推到本次时间、写 `habitat_claims` 日档并给 `users.resources.coins` 入账。
 * 两次并发铸币会在 habitat_state / users 文档上产生事务冲突，重试后走 hours=0 分支。
 */
async function claimHabitatSettle(input) {
    return db.runTransaction(async (transaction) => {
        const userRef = transaction.collection('users').doc(input.openid);
        const user = (await userRef.get()).data;
        if (!user) {
            return outcome('no-user', 0, 0);
        }
        const stateRef = transaction.collection('habitat_state').doc(input.openid);
        const state = (await stateRef.get()).data;
        const recorded = state && typeof state.lastClaimAt === 'number' ? state.lastClaimAt : 0;
        const earliest = input.now - MAX_LOOKBACK_MS;
        const start = recorded > 0 ? recorded : Math.min(Math.max(input.clientLastClaimAt, earliest), input.now);
        const hours = Math.max(0, Math.min(MAX_HOURS_PER_CLAIM, Math.floor((input.now - start) / HOUR_MS)));
        if (hours === 0) {
            return outcome('ok', 0, 0);
        }
        const dayId = `${input.openid}_${input.platformDate}`;
        const dayRef = transaction.collection('habitat_claims').doc(dayId);
        const day = (await dayRef.get()).data;
        const todayCount = day && typeof day.count === 'number' ? day.count : 0;
        if (todayCount >= MAX_DAILY_CLAIMS) {
            return outcome('limited', hours, 0);
        }
        const coins = hours * COINS_PER_PET_HOUR * input.adoptedCount * MOOD_FACTOR;
        const resources = {
            ...resourceView(user),
            coins: toCount(user.resources?.coins) + coins,
            updatedAt: input.now,
        };
        await userRef.update({ data: { resources } });
        await stateRef.set({
            data: { openid: input.openid, lastClaimAt: input.now, updatedAt: input.now },
        });
        await dayRef.set({
            data: {
                openid: input.openid,
                date: input.platformDate,
                count: todayCount + 1,
                hours: toCount(day?.hours) + hours,
                coins: toCount(day?.coins) + coins,
                updatedAt: input.now,
            },
        });
        return outcome('ok', hours, coins);
    }, TRANSACTION_RETRIES);
}
