// GENERATED from settle.ts by npm run build -- do not edit
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settleAdEvent = settleAdEvent;
// STATUS: implemented, W10-5/W21 adEvent 落库与频控（同一事务内完成主键去重 + ad_daily 计数 + 事件行写入）
// API: settleAdEvent, see docs/plan/集合与索引冻结.md §3.3 / §3.7
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database({ throwOnNotFound: false });
/** SDK 仅在事务冲突时自动重试，默认 3 次；命中此上限后抛出冲突异常，由 index.ts 映射成 1006。 */
const TRANSACTION_RETRIES = 3;
function outcome(doc) {
    return {
        granted: doc.granted === true,
        reward: null,
        todayCount: typeof doc.dailyCount === 'number' ? doc.dailyCount : 0,
    };
}
/**
 * 事务把「查是否重复」「占当日额度」「写最终结论」压成一个原子读改写：
 * 改造前用 where().count() 先查后写，并发上报会全部读到同一个旧值并集体越上限。
 * 冲突时 SDK 自动重试（默认 3 次），仍失败则由调用方按既有语义降级，不重试业务。
 */
async function settleAdEvent(input) {
    return db.runTransaction(async (transaction) => {
        const eventRef = transaction.collection('ad_events').doc(input.idempotencyKey);
        const existing = await eventRef.get();
        if (existing.data) {
            return outcome(existing.data);
        }
        let count = 0;
        const counterRef = transaction.collection('ad_daily').doc(input.dailyId);
        if (input.isEnded) {
            const current = await counterRef.get();
            count = current.data && typeof current.data.count === 'number' ? current.data.count : 0;
        }
        const granted = input.isEnded && count < input.limit;
        const dailyCount = granted ? count + 1 : count;
        if (granted) {
            await counterRef.set({
                data: { count: dailyCount, openid: input.openid, date: input.platformDate, updatedAt: input.now },
            });
        }
        const doc = {
            idempotencyKey: input.idempotencyKey,
            openid: input.openid,
            adSessionId: input.adSessionId,
            adUnitId: input.adUnitId,
            scene: input.scene,
            isEnded: input.isEnded,
            granted,
            reward: null,
            platformDate: input.platformDate,
            dailyCount,
            createdAt: input.now,
            reconciled: false,
        };
        await eventRef.set({ data: doc });
        return outcome(doc);
    }, TRANSACTION_RETRIES);
}
