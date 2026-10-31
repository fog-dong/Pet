// STATUS: implemented, W17-3 云存储音频文件播放（wx.createInnerAudioContext 一次性短音效，失败静默降级）
import { Track } from '../track/Track';

/** 小游戏并存的原生播放器实例有限，播完即销毁，同时限制在播数量。 */
const MAX_ACTIVE = 4;
/** 兜底回收：个别机型不回调 onEnded，超时后强制销毁，避免在播计数泄漏。 */
const MAX_PLAY_MS = 6000;

let active = 0;

/** 只接受已下载到本地沙盒的路径；平台不支持或播放失败都不抛错，由调用方当作静音处理。 */
export function playCloudAudio(path: string, volume: number): void {
  if (!path || typeof wx === 'undefined' || !wx.createInnerAudioContext) {
    return;
  }
  if (active >= MAX_ACTIVE) {
    return;
  }
  let context: WxInnerAudioContext;
  try {
    context = wx.createInnerAudioContext();
  } catch {
    return;
  }
  let settled = false;
  const finish = (): void => {
    if (settled) {
      return;
    }
    settled = true;
    active = Math.max(0, active - 1);
    try {
      context.destroy();
    } catch {
      Track.track('cloud_audio_destroy_failed');
    }
  };
  try {
    context.src = path;
    context.volume = volume;
    context.onError((): void => {
      Track.track('cloud_audio_failed');
      finish();
    });
    context.onEnded(finish);
    context.play();
  } catch {
    Track.track('cloud_audio_failed');
    finish();
    return;
  }
  setTimeout(finish, MAX_PLAY_MS);
}
