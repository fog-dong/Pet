// GENERATED from cases.ts by npm run build -- do not edit
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readCaseCatalog = readCaseCatalog;
// STATUS: implemented, W12-3 病例配置解析（`config` 集合 `configKey='cases'` 的 payload 与本工程 cases.json 同构）
const guard_1 = require("./guard");
function readCorrect(raw) {
    if (!(0, guard_1.isPlain)(raw)) {
        return undefined;
    }
    const correct = (0, guard_1.isPlain)(raw.correct) ? raw.correct : {};
    return {
        correct: {
            medicine: typeof correct.medicine === 'string' ? correct.medicine : undefined,
            bed: typeof correct.bed === 'string' ? correct.bed : undefined,
            time: typeof correct.time === 'string' ? correct.time : undefined,
        },
    };
}
function readBaseRewards(raw) {
    const source = (0, guard_1.isPlain)(raw) ? raw : {};
    return { coins: (0, guard_1.toCount)(source.coins), hearts: (0, guard_1.toCount)(source.hearts), affection: (0, guard_1.toCount)(source.affection) };
}
/** 配置缺失 / 结构不符时返回 null，由 index.ts 映射成 2002，不做客户端兜底发奖。 */
function readCaseCatalog(payload) {
    if (!(0, guard_1.isPlain)(payload) || !Array.isArray(payload.cases)) {
        return null;
    }
    const catalog = new Map();
    for (const raw of payload.cases) {
        if (!(0, guard_1.isPlain)(raw) || typeof raw.caseId !== 'string' || raw.caseId.length === 0) {
            continue;
        }
        catalog.set(raw.caseId, {
            caseId: raw.caseId,
            petSpecies: typeof raw.petSpecies === 'string' ? raw.petSpecies : undefined,
            petName: typeof raw.petName === 'string' ? raw.petName : undefined,
            severity: typeof raw.severity === 'string' ? raw.severity : undefined,
            treatment: readCorrect(raw.treatment),
            baseRewards: readBaseRewards(raw.baseRewards),
        });
    }
    return catalog.size > 0 ? catalog : null;
}
