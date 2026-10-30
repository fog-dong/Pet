// STATUS: implemented, W8 广告事件上报（服务端幂等记账；失败入本地队列，下次启动补发）
import { adUnitId } from '../config/AdConfig';
import { enqueueAdEvent, readPendingAdEvents, removePendingAdEvent } from '../cache/PendingAdEvent';
import { Net } from './Net';
import { Track } from '../track/Track';

interface AdEventData {
  granted?: boolean;
  todayCount?: number;
}

/** 发奖后异步上报；不阻塞玩法，网络失败先入队再补发。 */
export async function reportAdEvent(scene: string, adSessionId: string, isEnded: boolean): Promise<void> {
  const unit = adUnitId(scene);
  if (!unit) {
    return;
  }
  if (!Net.ready) {
    enqueueAdEvent({ adSessionId, adUnitId: unit, scene, isEnded });
    return;
  }
  const response = await Net.call<AdEventData>(
    'adEvent',
    { adSessionId, adUnitId: unit, scene, isEnded },
    { retry: 0 },
  );
  if (response.code < 0) {
    enqueueAdEvent({ adSessionId, adUnitId: unit, scene, isEnded });
    Track.track('ad_event_pending', { scene, code: response.code });
    return;
  }
  Track.track('ad_event_reported', {
    scene,
    isEnded,
    code: response.code,
    todayCount: response.data?.todayCount ?? 0,
  });
}

/** 启动时补发；网络失败保留队列，业务拒绝（含超限）直接出队。 */
export async function flushPendingAdEvents(): Promise<number> {
  if (!Net.ready) {
    return 0;
  }
  let sent = 0;
  for (const item of readPendingAdEvents()) {
    const response = await Net.call<AdEventData>(
      'adEvent',
      {
        adSessionId: item.adSessionId,
        adUnitId: item.adUnitId,
        scene: item.scene,
        isEnded: item.isEnded,
      },
      { retry: 1 },
    );
    if (response.code < 0) {
      break;
    }
    removePendingAdEvent(item.adSessionId);
    sent += 1;
    Track.track('ad_event_flushed', { scene: item.scene, code: response.code });
  }
  return sent;
}
