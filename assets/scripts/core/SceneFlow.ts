// STATUS: implemented, W6 场景跳转（FSM 白名单 + 场景加载 + 分包回收）；W16 P0 接入常驻淡入淡出层
import { GameState, gameFSM } from './GameFSM';
import { Res } from './Res';
import { fadeToScene } from './PageFade';
import { paintSceneBackground } from '../ui/ScreenTheme';
import { Track } from '../track/Track';

export async function goState(next: GameState, sceneName: string): Promise<boolean> {
  const ok = await gameFSM.transition(next);
  if (!ok) {
    return false;
  }
  if (!sceneName) {
    Res.releaseUnused();
    return true;
  }
  // 淡出 → loadScene → 淡入；新场景激活后旧场景已销毁，此时回收引用归零的分包。
  const loaded = await fadeToScene(sceneName);
  Res.releaseUnused();
  if (!loaded) {
    Track.track('scene_load_failed', { scene: sceneName, state: next });
    return false;
  }
  // 每个场景自带相机，默认清屏色是黑的，进页第一件事就把底色刷成暖米色。
  paintSceneBackground();
  return true;
}
