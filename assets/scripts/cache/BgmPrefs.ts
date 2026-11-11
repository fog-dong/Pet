// STATUS: implemented, W33 大厅音乐开关偏好（本地持久化，不进云存档；只有玩家亲手关过才记静音）
import { sys } from 'cc';

const KEY = 'pet_bgm_muted_v1';

export function bgmMuted(): boolean {
  return sys.localStorage.getItem(KEY) === '1';
}

export function setBgmMuted(muted: boolean): void {
  sys.localStorage.setItem(KEY, muted ? '1' : '0');
}
