// STATUS: implemented, W20-3 模块二 素材未就位时的合成兜底提示音（平台 WebAudio，不落文件、不占包体）
// 只有 net/ 允许触达平台音频接口；game/Sfx.ts 在分包与云存储都取不到源时调这里。
import { Track } from '../track/Track';
import type { FallbackTone } from '../config/AudioConfig';

/** 两条平台路径（wx.createWebAudioContext / 浏览器 AudioContext）共用这份最小声明。 */
type ToneContext = WxWebAudioContext;

let context: ToneContext | null = null;
/** 建不上就认为这台设备没有可用 WebAudio，只试一次，不在每次交互里反复抛错。 */
let unavailable = false;

function toneContext(): ToneContext | null {
  if (context) {
    return context;
  }
  if (unavailable) {
    return null;
  }
  try {
    if (typeof wx !== 'undefined' && wx.createWebAudioContext) {
      context = wx.createWebAudioContext() as unknown as ToneContext;
    } else if (typeof AudioContext !== 'undefined') {
      context = new AudioContext() as unknown as ToneContext;
    } else {
      unavailable = true;
      return null;
    }
    context.resume?.();
  } catch {
    unavailable = true;
    context = null;
    Track.track('sfx_tone_context_failed');
  }
  return context;
}

/** 短促「哔」：正弦起音 + 指数收尾。真实音频上传后 Sfx 会先命中分包/云存储源，这条路径自动退役。 */
export function playFallbackTone(tone: FallbackTone, volume: number): void {
  const ctx = toneContext();
  if (!ctx) {
    return;
  }
  try {
    const start = ctx.currentTime;
    const end = start + Math.max(0.04, tone.ms / 1000);
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(tone.freq, start);
    gain.gain.setValueAtTime(Math.max(0.0001, volume), start);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(end);
  } catch {
    Track.track('sfx_tone_play_failed');
  }
}
