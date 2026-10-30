// STATUS: implemented, W3 场景跳转（FSM 白名单 + 场景加载）
import { director } from 'cc';
import { GameState, gameFSM } from './GameFSM';
import { Track } from '../track/Track';

export async function goState(next: GameState, sceneName: string): Promise<boolean> {
  const ok = await gameFSM.transition(next);
  if (!ok) {
    return false;
  }
  if (sceneName && !director.loadScene(sceneName)) {
    Track.track('scene_load_failed', { scene: sceneName, state: next });
    return false;
  }
  return true;
}
