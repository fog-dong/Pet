// STATUS: implemented, W16 P0 ui 分包资源入口（九宫格 SpriteFrame + 圆体字体，失败一律回 null 走降级）
import { assetManager, SpriteFrame, TTFFont } from 'cc';
import { UI_BUNDLE } from '../config/BundleConfig';
import { Res } from '../core/Res';

const FRAME_INSET = 32;
const FONT_PATH = 'fonts/round';

const frames = new Map<string, SpriteFrame>();
const waiters = new Map<string, Array<(frame: SpriteFrame | null) => void>>();
let warming: Promise<boolean> | null = null;
let fontAsset: TTFFont | null = null;
let fontPending: Promise<TTFFont | null> | null = null;

/** 只加载一次 ui 分包；常驻引用不释放（每个场景都要用）。 */
export function warmUiBundle(): Promise<boolean> {
  if (!warming) {
    warming = Res.loadBundle(UI_BUNDLE).then((ok) => ok);
  }
  return warming;
}

export function getFrame(name: string): SpriteFrame | null {
  return frames.get(name) ?? null;
}

/** 拿不到贴图时回调 null，调用方保留 Graphics 外观。 */
export function ensureFrame(name: string, onReady: (frame: SpriteFrame | null) => void): void {
  const cached = frames.get(name);
  if (cached) {
    onReady(cached);
    return;
  }
  const queue = waiters.get(name);
  if (queue) {
    queue.push(onReady);
    return;
  }
  waiters.set(name, [onReady]);
  void warmUiBundle()
    .then((ok) => (ok ? loadFromBundle(name) : null))
    .then((frame) => {
      const list = waiters.get(name) ?? [];
      waiters.delete(name);
      if (frame) {
        frames.set(name, frame);
      }
      for (const cb of list) {
        cb(frame);
      }
    });
}

function loadFromBundle(name: string): Promise<SpriteFrame | null> {
  const bundle = assetManager.getBundle(UI_BUNDLE);
  if (!bundle) {
    return Promise.resolve(null);
  }
  return new Promise<SpriteFrame | null>((resolve) => {
    bundle.load(`${name}/spriteFrame`, SpriteFrame, (error, frame) => {
      if (error || !frame) {
        resolve(null);
        return;
      }
      applyInset(frame);
      resolve(frame);
    });
  });
}

/** 九宫格边距在代码里显式设，不依赖不同机器的导入参数。 */
export function applyInset(frame: SpriteFrame, inset = FRAME_INSET): SpriteFrame {
  frame.insetLeft = inset;
  frame.insetRight = inset;
  frame.insetTop = inset;
  frame.insetBottom = inset;
  return frame;
}

/** 圆体字体就绪后返回 TTFFont；分包缺失或字体未入库时返回 null，Label 继续用系统字。 */
export function loadUiFont(): Promise<TTFFont | null> {
  if (fontAsset) {
    return Promise.resolve(fontAsset);
  }
  if (fontPending) {
    return fontPending;
  }
  fontPending = warmUiBundle().then((ok) => {
    const bundle = ok ? assetManager.getBundle(UI_BUNDLE) : null;
    if (!bundle) {
      return null;
    }
    return new Promise<TTFFont | null>((resolve) => {
      bundle.load(FONT_PATH, TTFFont, (error, font) => {
        if (error || !font) {
          resolve(null);
          return;
        }
        fontAsset = font;
        resolve(font);
      });
    });
  });
  return fontPending;
}
