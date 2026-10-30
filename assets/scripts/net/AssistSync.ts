// STATUS: implemented, W7 助力补发（登录后重试；成功或业务拒绝即出队，网络失败保留）；W12-1 1006 视为可重试
import { readPendingAssist, removePendingAssist } from '../cache/PendingAssist';
import { Net } from './Net';
import { Track } from '../track/Track';

interface AssistData {
  granted?: boolean;
  assisted?: boolean;
  reason?: string | null;
}

/** 1006 = 服务端事务冲突重试耗尽，属可重试失败，保留队列下次再发。 */
const CODE_RETRY_EXHAUSTED = 1006;

export async function flushPendingAssist(): Promise<number> {
  if (!Net.ready) {
    return 0;
  }
  let sent = 0;
  for (const item of readPendingAssist()) {
    const response = await Net.call<AssistData>('assist', {
      friendOpenid: item.friendOpenid,
      resourceType: item.resourceType,
      nonce: item.nonce,
    });
    if (response.code < 0 || response.code === CODE_RETRY_EXHAUSTED) {
      break;
    }
    removePendingAssist(item.nonce);
    sent += 1;
    Track.track('assist_flushed', { scene: item.scene, code: response.code });
  }
  return sent;
}
