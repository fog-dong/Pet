// STATUS: implemented, W7 助力补发（登录后重试；成功或业务拒绝即出队，网络失败保留）
import { readPendingAssist, removePendingAssist } from '../cache/PendingAssist';
import { Net } from './Net';
import { Track } from '../track/Track';

interface AssistData {
  granted?: boolean;
  assisted?: boolean;
  reason?: string | null;
}

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
    if (response.code < 0) {
      break;
    }
    removePendingAssist(item.nonce);
    sent += 1;
    Track.track('assist_flushed', { scene: item.scene, code: response.code });
  }
  return sent;
}
