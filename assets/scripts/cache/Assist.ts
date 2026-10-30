// STATUS: implemented, W7 好友助力本地镜像（云端 assist 为准，本地记录当日助力与每日上限）
import { sys } from 'cc';
import { todayKey } from './DayKey';

const KEY = 'pet_assist_v1';
/** 06 §6.2：被助力方每日上限 5 次。 */
export const ASSIST_DAILY_LIMIT = 5;

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

/**
 * 关系链未接入：助力标识按「自然日 + 当日序号」本地生成，不伪装成微信 openid；
 * W8 换成分享票据校验后的真实 openid 后，这里只保留每日上限与本地镜像。
 */
export function nextAssistFriend(): AssistClaim {
  const state = load();
  if (state.total >= ASSIST_DAILY_LIMIT) {
    return { outcome: 'LIMIT', friendId: null };
  }
  return { outcome: 'granted', friendId: `share_${state.day}_${state.total + 1}` };
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
