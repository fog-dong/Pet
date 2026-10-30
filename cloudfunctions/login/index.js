// GENERATED from index.ts by npm run build -- do not edit
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
// STATUS: implemented
// API: login, see docs/plan/接口冻结清单.md §2.1
const cloud = require("wx-server-sdk");
const crypto_1 = require("crypto");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
function ok(data) {
    return { code: 0, msg: 'ok', data, serverTime: Date.now() };
}
function fail(code, msg) {
    return { code, msg, data: null, serverTime: Date.now() };
}
function sessionSecret() {
    const nodeProcess = globalThis.process;
    const secret = nodeProcess?.env?.SESSION_SECRET;
    if (!secret) {
        throw new Error('SESSION_SECRET_MISSING');
    }
    return secret;
}
// token 只绑定 openid 与过期时间，不在客户端可解码的载荷里放 openid。
function signToken(openid, expiresAt) {
    const signature = (0, crypto_1.createHmac)('sha256', sessionSecret()).update(`${openid}.${expiresAt}`).digest('hex');
    return `${expiresAt}.${signature}`;
}
async function createUser(openid, scene, now) {
    const db = cloud.database();
    const users = db.collection('users');
    try {
        await users.add({
            data: {
                _id: openid,
                openid,
                createdAt: now,
                lastLoginAt: now,
                lastScene: scene,
                status: 'active',
                revision: 0,
                resources: {
                    // 05 §9 初值与客户端 emptySave 对齐（金币 500 / 爱心 20）。
                    coins: 500,
                    hearts: 20,
                    beds: 0,
                    medicine: {},
                    trainingPoints: 0,
                    fragments: 0,
                    updatedAt: now,
                },
                reputation: 0,
                flags: {},
            },
        });
    }
    catch {
        const existing = await users.where({ openid }).limit(1).get();
        if (existing.data.length === 0) {
            throw new Error('USER_CREATE_FAILED');
        }
        return false;
    }
    await db.collection('hospital_state').doc(openid).set({
        data: {
            openid,
            level: 1,
            beds: 0,
            rooms: [],
            doctors: [],
            decorations: [],
            adoptionSlots: 0,
            reputation: 0,
            seasonState: {},
            revision: 0,
            updatedAt: now,
        },
    });
    return true;
}
async function main(event) {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) {
        return fail(1001, 'SESSION_INVALID');
    }
    const channel = event.channel;
    if (channel !== undefined && channel !== 'android' && channel !== 'ios' && channel !== 'dev') {
        return fail(1002, 'INVALID_PARAM');
    }
    if (event.scene !== undefined && typeof event.scene !== 'string') {
        return fail(1002, 'INVALID_PARAM');
    }
    if (event.version !== undefined && typeof event.version !== 'string') {
        return fail(1002, 'INVALID_PARAM');
    }
    const now = Date.now();
    const scene = typeof event.scene === 'string' ? event.scene : '';
    const users = cloud.database().collection('users');
    const found = await users.where({ openid: OPENID }).limit(1).get();
    let isNewUser = false;
    if (found.data.length === 0) {
        isNewUser = await createUser(OPENID, scene, now);
    }
    else {
        await users.where({ openid: OPENID }).update({ data: { lastLoginAt: now, lastScene: scene } });
    }
    return ok({
        token: signToken(OPENID, now + SESSION_TTL_MS),
        isNewUser,
        serverTime: now,
        minVersion: '0.0.0',
    });
}
