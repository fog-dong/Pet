// STATUS: implemented, W4 配置读取：优先 cases 分包，其次内置 resources
import { assetManager, JsonAsset, resources } from 'cc';

export const CONFIG_BUNDLE = 'cases';

/** 分包已加载则从分包读，否则退回归档在 resources 的旧路径。 */
export function loadConfigJson<T>(path: string): Promise<T | null> {
  return new Promise((resolve) => {
    const done = (error: Error | null, asset: JsonAsset | null): void => {
      resolve(error || !asset ? null : (asset.json as T));
    };
    const bundle = assetManager.getBundle(CONFIG_BUNDLE);
    if (bundle) {
      bundle.load(path, JsonAsset, done);
      return;
    }
    resources.load(path, JsonAsset, done);
  });
}
