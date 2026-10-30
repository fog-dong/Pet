// STATUS: implemented, W8 美术分包预留（art 未打包或加载失败时静默回退色块）
import { AssetManager, assetManager } from 'cc';
import { ART_BUNDLE } from '../config/BundleConfig';
import { Res } from '../core/Res';

let pending: Promise<AssetManager.Bundle | null> | null = null;

/**
 * 取 art 分包：已就绪直接返回，未打包/加载失败返回 null。
 * 调用方拿到 null 时继续用色块占位，不弹错、不阻断玩法。
 */
export function loadArtBundle(): Promise<AssetManager.Bundle | null> {
  const cached = assetManager.getBundle(ART_BUNDLE);
  if (cached) {
    return Promise.resolve(cached);
  }
  if (!pending) {
    pending = Res.loadBundle(ART_BUNDLE)
      .then(() => assetManager.getBundle(ART_BUNDLE))
      .catch(() => null);
  }
  return pending;
}

/** 角色/场景退出时释放 art 引用，真正的卸载交给 Res.releaseUnused。 */
export function releaseArtBundle(): void {
  Res.release(ART_BUNDLE);
}
