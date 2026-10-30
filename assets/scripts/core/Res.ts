// STATUS: implemented, W4 分包加载（assetManager + 引用计数，08 §8）
// API: Res.loadBundle / Res.release, see docs/plan/08-客户端架构与状态机.md §8
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

  release(tag: string): void {
    const state = this.bundles.get(tag);
    if (!state) {
      return;
    }
    state.refs -= 1;
    if (state.refs > 0) {
      return;
    }
    this.bundles.delete(tag);
    const bundle = assetManager.getBundle(tag);
    if (bundle) {
      assetManager.removeBundle(bundle);
    }
  }

  isLoaded(tag: string): boolean {
    return this.bundles.has(tag);
  }
}

export const Res = new ResManager();
