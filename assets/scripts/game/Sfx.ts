// STATUS: implemented, W17-3 音效统一播放入口（art 分包 AudioClip → 云存储下载文件 → 合成兜底音 → 静音；低画质关非必要音效）
// 业务侧只允许调用 Sfx.play(cue)；路径、云存储 key 与兜底音参数一律来自 config/AudioConfig.ts。
import { AudioClip, assetManager, AssetManager, AudioSource, director, Node } from 'cc';
import { AudioCue, AUDIO_TABLE, FallbackTone } from '../config/AudioConfig';
import { ART_BUNDLE } from '../config/BundleConfig';
import { Quality } from '../config/Quality';
import { CloudResManager } from '../net/CloudResManager';
import { playCloudAudio } from '../net/AudioFile';
import { playFallbackTone } from '../net/AudioSynth';
import { Track } from '../track/Track';
import { warmArtBundle } from './ArtBundle';

type Source =
  | { kind: 'clip'; clip: AudioClip }
  | { kind: 'file'; path: string }
  | { kind: 'beep'; tone: FallbackTone }
  | { kind: 'none' };

const sources = new Map<AudioCue, Source>();
const resolving = new Set<AudioCue>();
let audioNode: Node | null = null;

/** 分包音效走引擎播放器：节点挂在当前场景下，切场景失效后自动重建。 */
function getAudioSource(): AudioSource | null {
  if (audioNode && !audioNode.isValid) {
    audioNode = null;
  }
  if (!audioNode) {
    const scene = director.getScene();
    if (!scene) {
      return null;
    }
    audioNode = new Node('Sfx');
    audioNode.parent = scene;
  }
  const existing = audioNode.getComponent(AudioSource);
  return existing ?? audioNode.addComponent(AudioSource);
}

/** 先探一次分包里有没有这条音频：没有就别 load，免得控制台刷一屏资源缺失红字。 */
function bundleHasClip(bundle: AssetManager.Bundle, path: string): boolean {
  try {
    return bundle.getDirWithPath(path, AudioClip).length > 0;
  } catch {
    return false;
  }
}

export function loadArtClip(path: string): Promise<AudioClip | null> {
  return warmArtBundle()
    .then((ready) => {
      const bundle = ready ? assetManager.getBundle(ART_BUNDLE) : null;
      if (!bundle || !bundleHasClip(bundle, path)) {
        return null;
      }
      return new Promise<AudioClip | null>((resolve) => {
        bundle.load(path, AudioClip, (error, clip) => {
          resolve(error || !clip ? null : clip);
        });
      });
    })
    .catch(() => null);
}

async function resolveSource(cue: AudioCue): Promise<Source> {
  const def = AUDIO_TABLE[cue];
  if (def.bundlePath) {
    const clip = await loadArtClip(def.bundlePath);
    if (clip) {
      return { kind: 'clip', clip };
    }
  }
  const path = await CloudResManager.ensure(def.cloudKey);
  if (path) {
    return { kind: 'file', path };
  }
  // 素材还没上传的互动音先播合成「哔」，保证点击有反馈；真实音频到位后这一级自动让位。
  if (def.fallback) {
    Track.track('sfx_fallback', { cue });
    return { kind: 'beep', tone: def.fallback };
  }
  Track.track('sfx_unavailable', { cue });
  return { kind: 'none' };
}

function emit(source: Source, volume: number): void {
  if (source.kind === 'clip') {
    getAudioSource()?.playOneShot(source.clip, volume);
    return;
  }
  if (source.kind === 'file') {
    playCloudAudio(source.path, volume);
    return;
  }
  if (source.kind === 'beep') {
    playFallbackTone(source.tone, volume);
  }
}

export const Sfx = {
  /** 没登记的 cue 直接跳过；取不到的音效最多解析一次，之后保持静音，不重复下载。 */
  play(cue: AudioCue | null): void {
    if (!cue) {
      return;
    }
    const def = AUDIO_TABLE[cue];
    if (!def || muted(def.essential)) {
      return;
    }
    if (!audioAllowed()) {
      Sfx.warm([cue]);
      return;
    }
    const known = sources.get(cue);
    if (known) {
      emit(known, def.volume);
      return;
    }
    if (resolving.has(cue)) {
      return;
    }
    resolving.add(cue);
    void resolveSource(cue).then((source) => {
      resolving.delete(cue);
      sources.set(cue, source);
      if (source.kind !== 'none' && !muted(def.essential)) {
        emit(source, def.volume);
      }
    });
  },

  /** 预取来源但不发声：点击音若等到第一次按下才开始加载，第一下会慢半拍。 */
  warm(cues: AudioCue[]): void {
    for (const cue of cues) {
      if (sources.has(cue) || resolving.has(cue)) {
        continue;
      }
      resolving.add(cue);
      void resolveSource(cue).then((source) => {
        resolving.delete(cue);
        sources.set(cue, source);
      });
    }
  },
};

/** 低画质档位只保留必要音效；档位本身由 getConfig 的 quality 远程控制。 */
function muted(essential: boolean): boolean {
  return Quality.low && !essential;
}

/**
 * 浏览器在首次用户手势前会拦音频并刷控制台警告；小游戏容器没有 navigator.userActivation，按可播处理。
 * 返回 false 时调用方只解析来源、不真正发声，第一次触摸后自然恢复。
 */
export function audioAllowed(): boolean {
  const activation = (globalThis as unknown as {
    navigator?: { userActivation?: { hasBeenActive?: boolean } };
  }).navigator?.userActivation;
  return !activation || activation.hasBeenActive === true;
}
