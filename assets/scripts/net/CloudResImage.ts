// STATUS: implemented, W17-2 本地缓存图片 → SpriteFrame（小游戏 wx.createImage 解码）
import { ImageAsset, Rect, SpriteFrame, Texture2D } from 'cc';

const DECODE_TIMEOUT_MS = 8000;

/** 只接受已下载到 USER_DATA_PATH 的本地路径；失败返回 null，由调用方保留占位。 */
export function loadSpriteFrameFromFile(path: string): Promise<SpriteFrame | null> {
  const createImage = typeof wx === 'undefined' ? undefined : wx.createImage;
  if (!createImage || !path) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (frame: SpriteFrame | null): void => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(frame);
      }
    };
    const timer = setTimeout(() => finish(null), DECODE_TIMEOUT_MS);
    let image: WxImageElement;
    try {
      image = createImage();
    } catch {
      finish(null);
      return;
    }
    image.onload = (): void => {
      try {
        const asset = new ImageAsset(image as unknown as HTMLImageElement);
        const texture = new Texture2D();
        texture.image = asset;
        const frame = new SpriteFrame();
        frame.texture = texture;
        frame.rect = new Rect(0, 0, texture.width, texture.height);
        finish(frame);
      } catch {
        finish(null);
      }
    };
    image.onerror = (): void => finish(null);
    image.src = path;
  });
}
