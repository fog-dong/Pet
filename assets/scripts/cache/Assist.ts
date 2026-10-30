// STATUS: implemented, W7 好友助力本地镜像（云端 assist 为准，本地记录占位好友与每日上限）
import { sys } from 'cc';
import { todayKey } from './DayKey';

const KEY = 'pet_assist_v1';
/** 06 §6.2：被助力方每日上限 5 次。 */
export const ASSIST_DAILY_LIMIT = 5;
/** W7 无关系链，助力好友用本地占位 ID；W8 换分享票据里的真实 openid。 */
const MOCK_FRIENDS = ['wx_friend_lin', 'wx_friend_yu', 'wx_friend_ke', 'wx_friend_shu', 'wx_friend_an'];

export type AssistOutcome = 'granted' | 'ALREADY_ASSISTED' | 'LIMIT';

export interface AssistClaim {
  outcome: AssistOutcome;
  friendId: string | null;
}

interface AssistState {
  day: string;
  total: number;
  friends: string[];
}

function emptyState(): AssistState {
  return { day: todayKey(), total: 0, friends: [] };
}

function load(): AssistState {
  const fresh = emptyState();
  const raw = sys.localStorage.getItem(KEY);
  if (!raw) {
    return fresh;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AssistState>;
    if (parsed.day !== fresh.day) {
      return fresh;
    }
    return {
      day: fresh.day,
      total: typeof parsed.total === 'number' ? parsed.total : 0,
      friends: Array.isArray(parsed.friends)
        ? parsed.friends.filter((id): id is string => typeof id === 'string')
        : [],
    };
  } catch {
    return fresh;
  }
}

function save(state: AssistState): void {
  sys.localStorage.setItem(KEY, JSON.stringify(state));
}

export function assistReceivedToday(): number {
  return load().total;
}

/** 预览下一位可助力好友，不改状态；次数用尽返回 LIMIT，好友都用过返回 ALREADY_ASSISTED。 */
export function nextAssistFriend(): AssistClaim {
  const state = load();
  if (state.total >= ASSIST_DAILY_LIMIT) {
    return { outcome: 'LIMIT', friendId: null };
  }
  const friendId = MOCK_FRIENDS.find((id) => !state.friends.includes(id)) ?? null;
  return friendId ? { outcome: 'granted', friendId } : { outcome: 'ALREADY_ASSISTED', friendId: null };
}

export function recordAssist(friendId: string): void {
  if (!friendId) {
    return;
  }
  const state = load();
  if (state.friends.includes(friendId)) {
    return;
  }
  state.total += 1;
  state.friends.push(friendId);
  save(state);
}

/** 本地兜底：直接记一位好友到账，返回实际记录的好友 ID 供补发队列使用。 */
export function claimNextAssist(): AssistClaim {
  const claim = nextAssistFriend();
  if (claim.outcome === 'granted' && claim.friendId) {
    recordAssist(claim.friendId);
  }
  return claim;
}
