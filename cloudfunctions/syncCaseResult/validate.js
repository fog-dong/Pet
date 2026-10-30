// GENERATED from validate.ts by npm run build -- do not edit
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readDiagnosis = readDiagnosis;
exports.readTreatment = readTreatment;
// STATUS: implemented, W12-3 入参校验（冻结 §2.4 的 DiagnosisInput / TreatmentInput）
const guard_1 = require("./guard");
const DIAGNOSIS_TYPES = ['auscultation', 'xray', 'lab'];
const TREATMENT_RESULTS = ['success', 'partial', 'fail'];
const MAX_MEDICINES = 10;
function readDiagnosis(raw) {
    if (!(0, guard_1.isPlain)(raw)) {
        return null;
    }
    const { type, stars, mistakes, durationMs } = raw;
    if (typeof type !== 'string' || !DIAGNOSIS_TYPES.includes(type)) {
        return null;
    }
    if (!(0, guard_1.isInt)(stars, 0, 3) || !(0, guard_1.isInt)(mistakes, 0, 99) || !(0, guard_1.isInt)(durationMs, 0, 24 * 3600 * 1000)) {
        return null;
    }
    return { type: type, stars, mistakes, durationMs };
}
function readTreatment(raw) {
    if (!(0, guard_1.isPlain)(raw)) {
        return null;
    }
    const { result, medicineUsed, bedUsed, healing } = raw;
    if (typeof result !== 'string' || !TREATMENT_RESULTS.includes(result)) {
        return null;
    }
    if (!Array.isArray(medicineUsed) || medicineUsed.length > MAX_MEDICINES) {
        return null;
    }
    if (!medicineUsed.every((item) => typeof item === 'string' && item.length > 0)) {
        return null;
    }
    if (typeof bedUsed !== 'boolean' || !(0, guard_1.isInt)(healing, 0, 3)) {
        return null;
    }
    return { result: result, medicineUsed: [...medicineUsed], bedUsed, healing };
}
