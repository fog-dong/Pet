// STATUS: implemented, W6 场景跳转（FSM 白名单 + 场景加载 + 分包回收）
import { director } from 'cc';
import { GameState, gameFSM } from './GameFSM';
import { Res } from './Res';
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
  return new Promise<boolean>((resolve) => {
    const launched = director.loadScene(sceneName, (error) => {
      // 新场景激活后旧场景已销毁，此时回收引用归零的分包。
      Res.releaseUnused();
      if (error) {
        Track.track('scene_load_failed', { scene: sceneName, state: next });
        resolve(false);
        return;
      }
      // 每个场景自带相机，默认清屏色是黑的，进页第一件事就把底色刷成暖米色。
      paintSceneBackground();
      resolve(true);
    });
    if (!launched) {
      Track.track('scene_load_failed', { scene: sceneName, state: next });
      resolve(false);
    }
  });
}
