// STATUS: implemented, W33 大厅 BGM 单曲循环（art 分包 bgm_lobby；低画质档与加载失败都静音，不阻断玩法）
import { AudioClip, AudioSource, director, input, Input, Node } from 'cc';
import { BGM_LOBBY } from '../config/AudioConfig';
import { Quality } from '../config/Quality';
import { Track } from '../track/Track';
import { loadArtClip, audioAllowed } from './Sfx';

let node: Node | null = null;
let source: AudioSource | null = null;
let clip: AudioClip | null = null;
let loading = false;
let started = false;
let gestureBound = false;

/** 常驻节点：引擎切场景时会把它带过去，大厅音乐不会每次转场都从头断一次。 */
function ensureSource(): AudioSource | null {
  if (node && node.isValid) {
    return source;
  }
  const scene = director.getScene();
  if (!scene) {
    return null;
  }
  node = new Node('Bgm');
  scene.addChild(node);
  director.addPersistRootNode(node);
  source = node.addComponent(AudioSource);
  source.playOnAwake = false;
  source.loop = true;
  source.volume = BGM_LOBBY.volume;
  return source;
}

/** iOS 与浏览器首次自动播放会被拦：等第一次触摸再补播，播起来就解绑。 */
function watchGesture(): void {
  if (gestureBound) {
    return;
  }
  gestureBound = true;
  const retry = (): void => {
    if (source?.playing) {
      input.off(Input.EventType.TOUCH_START, retry);
      gestureBound = false;
      return;
    }
    play();
  };
  input.on(Input.EventType.TOUCH_START, retry);
}

function play(): void {
  if (!source || !clip || Quality.low) {
    return;
  }
  if (!audioAllowed()) {
    watchGesture();
    return;
  }
  source.play();
  if (!source.playing) {
    watchGesture();
  }
}

function load(): void {
  if (loading || clip || Quality.low) {
    return;
  }
  loading = true;
  void loadArtClip(BGM_LOBBY.bundlePath).then((loaded) => {
    loading = false;
    if (!loaded) {
      Track.track('bgm_unavailable', { path: BGM_LOBBY.bundlePath });
      return;
    }
    clip = loaded;
    const target = ensureSource();
    if (target) {
      target.clip = clip;
      Track.track('bgm_ready', { path: BGM_LOBBY.bundlePath });
      play();
    }
  });
}

export const Bgm = {
  /** 大厅 entry 调一次；重复调用无副作用，低画质档下改到高画质会自动补播。 */
  start(): void {
    if (started) {
      return;
    }
    started = true;
    Quality.subscribe((low) => {
      if (low) {
        source?.stop();
        return;
      }
      load();
      play();
    });
    load();
  },
};
