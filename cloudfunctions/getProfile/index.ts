// STATUS: implemented, W8 个人资料（只读当前 openid 的 users / hospital_state / pets）
// API: getProfile, see docs/plan/接口冻结清单.md §2.2
import * as cloud from 'wx-server-sdk';

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database({ throwOnNotFound: false });

interface CloudResponse<T> {
  code: number;
  msg: string;
  data: T | null;
  serverTime?: number;
}

interface UserDoc {
  nickname?: string;
  avatarUrl?: string;
  createdAt?: number;
  lastLoginAt?: number;
  status?: string;
  revision?: number;
  resources?: Record<string, unknown>;
  reputation?: number;
  flags?: Record<string, unknown>;
}

interface HospitalDoc {
  level?: number;
  beds?: number;
  rooms?: unknown[];
  doctors?: unknown[];
  decorations?: unknown[];
  adoptionSlots?: number;
  reputation?: number;
  seasonState?: Record<string, unknown>;
  revision?: number;
  updatedAt?: number;
}

interface PetDoc {
  petId?: string;
  breed?: string;
  name?: string;
  rarity?: string;
  affection?: number;
  careScore?: number;
  updatedAt?: number;
}

interface UserSummary {
  nickname: string; avatarUrl: string; reputation: number; revision: number;
  createdAt: number; lastLoginAt: number; status: string; flags: Record<string, unknown>;
}

interface HospitalSummary {
  level: number; beds: number; rooms: unknown[]; doctors: unknown[]; decorations: unknown[];
  adoptionSlots: number; reputation: number; seasonState: Record<string, unknown>;
  revision: number; updatedAt: number;
}

interface PetSummary {
  petId: string; breed: string; name: string; rarity: string;
  affection: number; careScore: number; updatedAt: number;
}

interface ProfileData {
  user: UserSummary | null;
  hospital: HospitalSummary | null;
  resources: Record<string, unknown> | null;
  collection: { adoptedCount: number; pets: PetSummary[] };
}

const PET_LIMIT = 50;

function ok<T>(data: T): CloudResponse<T> {
  return { code: 0, msg: 'ok', data, serverTime: Date.now() };
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function summarizeUser(user: UserDoc): UserSummary {
  return {
    nickname: text(user.nickname), avatarUrl: text(user.avatarUrl), reputation: num(user.reputation),
    revision: num(user.revision), createdAt: num(user.createdAt), lastLoginAt: num(user.lastLoginAt),
    status: text(user.status), flags: user.flags ?? {},
  };
}

function summarizeHospital(hospital: HospitalDoc): HospitalSummary {
  return {
    level: num(hospital.level), beds: num(hospital.beds), rooms: hospital.rooms ?? [],
    doctors: hospital.doctors ?? [], decorations: hospital.decorations ?? [],
    adoptionSlots: num(hospital.adoptionSlots), reputation: num(hospital.reputation),
    seasonState: hospital.seasonState ?? {}, revision: num(hospital.revision),
    updatedAt: num(hospital.updatedAt),
  };
}

function summarizePet(pet: PetDoc): PetSummary {
  return {
    petId: text(pet.petId), breed: text(pet.breed), name: text(pet.name), rarity: text(pet.rarity),
    affection: num(pet.affection), careScore: num(pet.careScore), updatedAt: num(pet.updatedAt),
  };
}

export async function main(): Promise<CloudResponse<ProfileData>> {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { code: 1001, msg: 'SESSION_INVALID', data: null, serverTime: Date.now() };
  }

  // 身份只取上下文中的 openid：入参不参与查询，也不接受任何 openid 字段。
  const users = await db.collection<UserDoc>('users').where({ openid: OPENID }).limit(1).get();
  const hospital = await db.collection<HospitalDoc>('hospital_state').doc(OPENID).get();
  const pets = await db
    .collection<PetDoc>('pets')
    .where({ openid: OPENID, status: 'adopted' })
    .limit(PET_LIMIT)
    .get();

  const userDoc = users.data[0];
  const petList = pets.data.map(summarizePet);
  return ok<ProfileData>({
    user: userDoc ? summarizeUser(userDoc) : null,
    hospital: hospital.data ? summarizeHospital(hospital.data) : null,
    resources: userDoc?.resources ?? null,
    collection: { adoptedCount: petList.length, pets: petList },
  });
}
