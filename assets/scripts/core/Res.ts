// STATUS: implemented, W6 分包加载（assetManager + 引用计数 + 场景切换回收，08 §8）
// API: Res.loadBundle / Res.release / Res.releaseUnused, see docs/plan/08-客户端架构与状态机.md §8
import { assetManager } from 'cc';

interface BundleState {
  name: string;
  refs: number;
}

export class ResManager {
  private readonly bundles = new Map<string, BundleState>();

  loadBundle(name: string): Promise<boolean> {
    if (!name) {
      return Promise.resolve(false);
    }
    const existing = this.bundles.get(name);
    if (existing) {
      existing.refs += 1;
      return Promise.resolve(true);
    }
    if (assetManager.getBundle(name)) {
      this.bundles.set(name, { name, refs: 1 });
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      assetManager.loadBundle(name, (error, bundle) => {
        if (error || !bundle) {
          resolve(false);
          return;
        }
        this.bundles.set(name, { name, refs: 1 });
        resolve(true);
      });
    });
  }

  /** 只减引用，不立刻卸载；真正卸载交给场景切换后的 releaseUnused。 */
  release(tag: string): void {
    const state = this.bundles.get(tag);
    if (!state || state.refs <= 0) {
      return;
    }
    state.refs -= 1;
  }

  /** 场景切换后调用：引用归零的分包统一卸载，避免常驻内存。 */
  releaseUnused(): void {
    for (const [name, state] of this.bundles) {
      if (state.refs > 0) {
        continue;
      }
      this.bundles.delete(name);
      const bundle = assetManager.getBundle(name);
      if (bundle) {
        assetManager.removeBundle(bundle);
      }
    }
  }

  isLoaded(tag: string): boolean {
    return this.bundles.has(tag);
  }
}

export const Res = new ResManager();
