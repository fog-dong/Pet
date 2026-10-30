// STATUS: implemented, W5 好友助力本地模拟（每日上限 5 + 同好友 1 次/天；接服务端 assist 后替换）
import { sys } from 'cc';
import { todayKey } from './DayKey';

const KEY = 'pet_assist_v1';
/** 06 §6.2：被助力方每日上限 5 次。 */
export const ASSIST_DAILY_LIMIT = 5;
/** 本地模拟的好友池：每人每天最多助力 1 次。 */
const MOCK_FRIENDS = ['wx_friend_lin', 'wx_friend_yu', 'wx_friend_ke', 'wx_friend_shu', 'wx_friend_an'];

export type AssistOutcome = 'granted' | 'ALREADY_ASSISTED' | 'LIMIT';

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

/** 本地模拟：按池顺序取一位今日未助力过的好友，保证同一好友每天只 +1。 */
export function claimNextAssist(): AssistOutcome {
  const state = load();
  if (state.total >= ASSIST_DAILY_LIMIT) {
    return 'LIMIT';
  }
  const friendId = MOCK_FRIENDS.find((id) => !state.friends.includes(id));
  if (!friendId) {
    return 'ALREADY_ASSISTED';
  }
  state.total += 1;
  state.friends.push(friendId);
  save(state);
  return 'granted';
}
