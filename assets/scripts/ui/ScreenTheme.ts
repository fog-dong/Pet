// STATUS: implemented, W16-1 统一场景底色：各页不再落在相机默认黑底上
import { Camera, Color, director } from 'cc';

/** 暖米色底：与 PALETTE.panel/primary 同一套治愈系配色。 */
export const SCREEN_BG = new Color(247, 241, 232, 255);

/** 把当前场景的相机清屏色改成暖米色；找不到相机时静默跳过，不阻塞进页。 */
export function paintSceneBackground(color: Color = SCREEN_BG): void {
  const camera = director.getScene()?.getComponentInChildren(Camera);
  if (!camera) {
    return;
  }
  camera.clearFlags = Camera.ClearFlag.SOLID_COLOR;
  camera.clearColor = color;
}
