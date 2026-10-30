// GENERATED from settle.ts by npm run build -- do not edit
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settleCaseResult = settleCaseResult;
// STATUS: implemented, W12-3 事务式幂等结算（pets_cases 首写 + users.resources 只加一次）
const cloud = require("wx-server-sdk");
const formula_1 = require("./formula");
const guard_1 = require("./guard");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database({ throwOnNotFound: false });
/** SDK 仅在事务冲突时自动重试，默认 3 次；命中上限后由 index.ts 映射成 1006。 */
const TRANSACTION_RETRIES = 3;
function resourceView(user) {
    return (0, guard_1.isPlain)(user.resources) ? user.resources : {};
}
/**
 * 幂等键 `openid + caseSessionId` 落成 `pets_cases._id = openid:caseSessionId`：
 * 同一单局重放命中已存在文档直接回放历史结果；首次结算在同一个事务里写单局记录并给
 * `users.resources` 入账，两个并发首写会在 users 文档上产生事务冲突，重试后走回放分支。
 * 首通倍率用 `users.flags.caseStars`（病例历史最高星）判定，同样在事务内读改写。
 */
async function settleCaseResult(input) {
    return db.runTransaction(async (transaction) => {
        const userRef = transaction.collection('users').doc(input.openid);
        const user = (await userRef.get()).data;
        if (!user) {
            return null;
        }
        const caseRef = transaction.collection('pets_cases').doc(`${input.openid}:${input.caseSessionId}`);
        const existing = (await caseRef.get()).data;
        if (existing && existing.result && existing.rewards) {
            return { replayed: true, result: existing.result, rewards: existing.rewards, resources: resourceView(user) };
        }
        const computed = (0, formula_1.computeCase)(input.item, input.diagnosis, input.treatment);
        const flags = (0, guard_1.isPlain)(user.flags) ? { ...user.flags } : {};
        const caseStars = (0, guard_1.isPlain)(flags.caseStars) ? { ...flags.caseStars } : {};
        const previousStars = (0, guard_1.toCount)(caseStars[input.caseId]);
        const firstClear = previousStars === 0 && computed.stars > 0;
        const amounts = (0, formula_1.rewardAmounts)(input.item.baseRewards, computed.stars, firstClear);
        const resources = {
            ...resourceView(user),
            coins: (0, guard_1.toCount)(user.resources?.coins) + amounts.coins,
            hearts: (0, guard_1.toCount)(user.resources?.hearts) + amounts.hearts,
            updatedAt: input.now,
        };
        const result = {
            caseId: input.caseId,
            status: computed.status,
            stars: computed.stars,
            diagnosisStars: computed.diagnosisStars,
            treatmentStars: computed.treatmentStars,
            recoveryStars: computed.recoveryStars,
            firstClear,
            durationMs: input.durationMs,
            finishedAt: input.now,
        };
        const rewards = {
            coins: amounts.coins,
            hearts: amounts.hearts,
            reputation: 0,
            affection: computed.affection,
        };
        await caseRef.set({
            data: {
                caseSessionId: input.caseSessionId,
                openid: input.openid,
                caseId: input.caseId,
                petSpecies: input.item.petSpecies ?? '',
                petName: input.item.petName ?? '',
                severity: input.item.severity ?? 'normal',
                diagnosis: { ...input.diagnosis },
                treatment: { ...input.treatment },
                affection: computed.affection,
                status: computed.status,
                result,
                rewards,
                createdAt: input.now,
                finishedAt: input.now,
            },
        });
        await userRef.update({
            data: {
                resources,
                flags: { ...flags, caseStars: { ...caseStars, [input.caseId]: Math.max(previousStars, computed.stars) } },
            },
        });
        return { replayed: false, result, rewards, resources };
    }, TRANSACTION_RETRIES);
}
