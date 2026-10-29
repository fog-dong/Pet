"use strict";
// STATUS: implemented
// saveGame 快照校验：只接受白名单字段，数值必须为非负整数。
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNonNegativeInt = isNonNegativeInt;
exports.isPlainObject = isPlainObject;
exports.readSnapshot = readSnapshot;
const LEVEL_MIN = 1;
const LEVEL_MAX = 6;
const NON_NEGATIVE_FIELDS = ['beds', 'adoptionSlots', 'reputation'];
const RESOURCE_INTS = ['coins', 'hearts', 'beds', 'trainingPoints', 'fragments'];
const ARRAY_FIELDS = ['rooms', 'doctors', 'decorations'];
function isNonNegativeInt(value) {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function readResources(raw) {
    const resources = {};
    for (const key of RESOURCE_INTS) {
        const value = raw[key];
        if (value === undefined) {
            continue;
        }
        if (!isNonNegativeInt(value)) {
            return null;
        }
        resources[key] = value;
    }
    const medicine = raw.medicine;
    if (medicine !== undefined) {
        if (!isPlainObject(medicine)) {
            return null;
        }
        for (const key of Object.keys(medicine)) {
            if (!isNonNegativeInt(medicine[key])) {
                return null;
            }
        }
        resources.medicine = medicine;
    }
    return resources;
}
function readSnapshot(raw) {
    const state = {};
    const level = raw.level;
    if (level !== undefined) {
        if (!isNonNegativeInt(level) || level < LEVEL_MIN || level > LEVEL_MAX) {
            return null;
        }
        state.level = level;
    }
    for (const key of NON_NEGATIVE_FIELDS) {
        const value = raw[key];
        if (value === undefined) {
            continue;
        }
        if (!isNonNegativeInt(value)) {
            return null;
        }
        state[key] = value;
    }
    for (const key of ARRAY_FIELDS) {
        const value = raw[key];
        if (value === undefined) {
            continue;
        }
        if (!Array.isArray(value)) {
            return null;
        }
        state[key] = value;
    }
    const seasonState = raw.seasonState;
    if (seasonState !== undefined) {
        if (!isPlainObject(seasonState)) {
            return null;
        }
        state.seasonState = seasonState;
    }
    let resources = null;
    if (raw.resources !== undefined) {
        if (!isPlainObject(raw.resources)) {
            return null;
        }
        resources = readResources(raw.resources);
        if (!resources) {
            return null;
        }
    }
    return { state, resources };
}
