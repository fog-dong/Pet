// STATUS: implemented, W5 领养页动作（用户主动分享 + 本地助力模拟，不强制分享）
import { claimNextAssist } from '../cache/Assist';
import { Share } from '../net/Share';
import { Track } from '../track/Track';

/** 06 §5.2 助力请求文案：第一人称，不写“求助力”等诱导话术。 */
export const ASSIST_TITLE = '医院床位不够了，能来搭把手吗？';

export type AssistResult = 'granted' | 'ALREADY_ASSISTED' | 'LIMIT';

export function requestAssist(scene: string): AssistResult {
  Track.track('share_click', { scene });
  const shared = Share.toFriend({ title: ASSIST_TITLE, query: `scene=${scene}` });
  Track.track('share_result', { scene, shared });
  const outcome = claimNextAssist();
  if (outcome === 'granted') {
    // 非微信环境（编辑器/浏览器预览）也按本地好友到账处理，保证单机可玩。
    Track.track('assist_received', { scene, mock: !shared });
  }
  return outcome;
}

export function assistHint(outcome: AssistResult): string {
  if (outcome === 'granted') {
    return '好友助力到账（本地模拟）';
  }
  return outcome === 'ALREADY_ASSISTED'
    ? '今天这几位好友都帮过忙了，明天再来'
    : '今日助力次数已用完，明天再来';
}
