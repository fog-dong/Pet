// STATUS: implemented, W7 领养页动作（用户主动分享 + 云端助力，断网本地到账并补发）
import { claimNextAssist, nextAssistFriend, recordAssist } from '../cache/Assist';
import { enqueueAssist } from '../cache/PendingAssist';
import { Net } from '../net/Net';
import { Share } from '../net/Share';
import { Track } from '../track/Track';

/** 服务端每日助力上限，见接口冻结清单 §2.6。 */
const CODE_TODAY_ASSIST_LIMIT = 1005;

/** 06 §5.2 助力请求文案：第一人称，不写“求助力”等诱导话术。 */
export const ASSIST_TITLE = '医院床位不够了，能来搭把手吗？';

export type AssistResult = 'granted' | 'ALREADY_ASSISTED' | 'LIMIT';

interface AssistData {
  granted?: boolean;
  assisted?: boolean;
  reason?: string | null;
  dailyCount?: number;
}

function makeNonce(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export async function requestAssist(scene: string): Promise<AssistResult> {
  Track.track('share_click', { scene });
  const shared = Share.toFriend({ title: ASSIST_TITLE, query: `scene=${scene}` });
  Track.track('share_result', { scene, shared });

  const peek = nextAssistFriend();
  if (!peek.friendId) {
    Track.track('assist_blocked', { scene, outcome: peek.outcome });
    return peek.outcome;
  }
  if (!Net.ready) {
    return fallback(peek.friendId, scene, 'offline');
  }

  const response = await Net.call<AssistData>('assist', {
    friendOpenid: peek.friendId,
    resourceType: 'heart',
    nonce: makeNonce(),
  });
  if (response.code === CODE_TODAY_ASSIST_LIMIT) {
    // 服务端已到上限：不能走本地兜底，否则会绕开每日上限。
    Track.track('assist_rejected', { scene, reason: 'TODAY_ASSIST_LIMIT' });
    return 'LIMIT';
  }
  if (response.code !== 0 || !response.data) {
    return fallback(peek.friendId, scene, `code_${response.code}`);
  }

  const data = response.data;
  if (data.granted === true || data.assisted === true) {
    recordAssist(peek.friendId);
    Track.track('assist_received', { scene, source: 'cloud', dailyCount: data.dailyCount ?? 0 });
    return 'granted';
  }
  Track.track('assist_rejected', { scene, reason: data.reason ?? 'unknown' });
  return data.reason === 'LIMIT' ? 'LIMIT' : 'ALREADY_ASSISTED';
}

/** 云端失败不挡玩法：先本地记录到账，再写入补发队列，下次启动重试。 */
function fallback(friendId: string, scene: string, reason: string): AssistResult {
  const claim = claimNextAssist();
  if (claim.outcome === 'granted' && claim.friendId) {
    enqueueAssist({ friendOpenid: claim.friendId, resourceType: 'heart', scene, nonce: makeNonce() });
    Track.track('assist_pending', { scene, reason, friendOpenid: friendId });
  }
  return claim.outcome;
}

export function assistHint(outcome: AssistResult): string {
  if (outcome === 'granted') {
    return '好友助力到账';
  }
  return outcome === 'ALREADY_ASSISTED'
    ? '今天这几位好友都帮过忙了，明天再来'
    : '今日助力次数已用完，明天再来';
}
