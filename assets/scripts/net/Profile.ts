// STATUS: implemented, W8 个人资料拉取（只读当前 openid，Lobby 后台刷新）
import { Net } from './Net';
import { Track } from '../track/Track';

export interface ProfilePet {
  petId: string;
  breed: string;
  name: string;
  rarity: string;
  affection: number;
  careScore: number;
  updatedAt: number;
}

export interface ProfileSnapshot {
  user: {
    nickname: string;
    avatarUrl: string;
    reputation: number;
    revision: number;
    createdAt: number;
    lastLoginAt: number;
    status: string;
    flags: Record<string, unknown>;
  } | null;
  hospital: {
    level: number;
    beds: number;
    adoptionSlots: number;
    reputation: number;
    revision: number;
    updatedAt: number;
  } | null;
  resources: Record<string, unknown> | null;
  collection: { adoptedCount: number; pets: ProfilePet[] };
}

export class ProfileStore {
  private current: ProfileSnapshot | null = null;

  get snapshot(): ProfileSnapshot | null {
    return this.current;
  }

  get adoptedCount(): number {
    return this.current?.collection.adoptedCount ?? 0;
  }

  /** 失败不改写上次快照：界面继续用本地存档，云资料只做补充。 */
  async refresh(): Promise<boolean> {
    if (!Net.ready) {
      return false;
    }
    const response = await Net.call<ProfileSnapshot>('getProfile');
    if (response.code !== 0 || !response.data) {
      Track.track('profile_load_fail', { code: response.code });
      return false;
    }
    this.current = response.data;
    Track.track('profile_loaded', {
      revision: response.data.user?.revision ?? 0,
      adopted: response.data.collection.adoptedCount,
    });
    return true;
  }
}

export const Profile = new ProfileStore();
