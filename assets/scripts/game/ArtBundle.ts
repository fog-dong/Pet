// STATUS: implemented, W9-3 美术分包预热（art 未打包或加载失败时显式回退色块，不阻断玩法）
import { AssetManager, assetManager } from 'cc';
import { ART_BUNDLE } from '../config/BundleConfig';
import { Res } from '../core/Res';
import { Track } from '../track/Track';

let pending: Promise<AssetManager.Bundle | null> | null = null;
let warming: Promise<boolean> | null = null;

/**
 * 取 art 分包：已就绪直接返回，未打包或加载失败返回 null。
 * 引用由 Res 记账，加载后常驻（宠物立绘在大厅、病例、康复三处连续使用）。
 */
function loadArtBundle(): Promise<AssetManager.Bundle | null> {
  const cached = assetManager.getBundle(ART_BUNDLE);
  if (cached) {
    return Promise.resolve(cached);
  }
  if (!pending) {
    pending = Res.loadBundle(ART_BUNDLE)
      .then(() => assetManager.getBundle(ART_BUNDLE) ?? null)
      .catch(() => null);
  }
  return pending;
}

/** 首次显示宠物时预热 art：不 await，失败走色块分支，由调用方继续渲染。 */
export function warmArtBundle(): Promise<boolean> {
  // 大厅同一帧里医生和两三只宠物会一起要图：只要第一次加载还没回来，后来的调用必须等同一个 Promise，
  // 不能按「bundle 此刻不在」直接判 false —— 那会把先到的那只打成永久「待补图」。
  if (!warming) {
    warming = loadArtBundle().then((bundle) => {
      const ready = bundle !== null;
      // 显式两分支：色块占位是 ready=false 的正常路径，不是异常吞掉。
      Track.track(ready ? 'art_bundle_ready' : 'art_bundle_fallback', { bundle: ART_BUNDLE });
      return ready;
    });
  }
  return warming;
}
