// GENERATED from index.ts by npm run build -- do not edit
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
// STATUS: implemented, W8 个人资料（只读当前 openid 的 users / hospital_state / pets）
// API: getProfile, see docs/plan/接口冻结清单.md §2.2
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database({ throwOnNotFound: false });
const PET_LIMIT = 50;
function ok(data) {
    return { code: 0, msg: 'ok', data, serverTime: Date.now() };
}
function text(value) {
    return typeof value === 'string' ? value : '';
}
function num(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
function summarizeUser(user) {
    return {
        nickname: text(user.nickname), avatarUrl: text(user.avatarUrl), reputation: num(user.reputation),
        revision: num(user.revision), createdAt: num(user.createdAt), lastLoginAt: num(user.lastLoginAt),
        status: text(user.status), flags: user.flags ?? {},
    };
}
function summarizeHospital(hospital) {
    return {
        level: num(hospital.level), beds: num(hospital.beds), rooms: hospital.rooms ?? [],
        doctors: hospital.doctors ?? [], decorations: hospital.decorations ?? [],
        adoptionSlots: num(hospital.adoptionSlots), reputation: num(hospital.reputation),
        seasonState: hospital.seasonState ?? {}, revision: num(hospital.revision),
        updatedAt: num(hospital.updatedAt),
    };
}
function summarizePet(pet) {
    return {
        petId: text(pet.petId), breed: text(pet.breed), name: text(pet.name), rarity: text(pet.rarity),
        affection: num(pet.affection), careScore: num(pet.careScore), updatedAt: num(pet.updatedAt),
    };
}
async function main() {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) {
        return { code: 1001, msg: 'SESSION_INVALID', data: null, serverTime: Date.now() };
    }
    // 身份只取上下文中的 openid：入参不参与查询，也不接受任何 openid 字段。
    const users = await db.collection('users').where({ openid: OPENID }).limit(1).get();
    const hospital = await db.collection('hospital_state').doc(OPENID).get();
    const pets = await db
        .collection('pets')
        .where({ openid: OPENID, status: 'adopted' })
        .limit(PET_LIMIT)
        .get();
    const userDoc = users.data[0];
    const petList = pets.data.map(summarizePet);
    return ok({
        user: userDoc ? summarizeUser(userDoc) : null,
        hospital: hospital.data ? summarizeHospital(hospital.data) : null,
        resources: userDoc?.resources ?? null,
        collection: { adoptedCount: petList.length, pets: petList },
    });
}
