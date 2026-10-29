// STATUS: scaffold, API frozen by architect on 2026-10-29
// API: Res.loadBundle / Res.release, see docs/plan/08-客户端架构与状态机.md §8

interface BundleState {
  name: string;
  refs: number;
}

export class ResManager {
  private readonly bundles = new Map<string, BundleState>();

  /**
   * W1 占位：未接入 Cocos assetManager，固定返回 false。
   * W2 接入后按引用计数加载，业务层只通过本方法获取分包。
   */
  async loadBundle(name: string): Promise<boolean> {
    if (!name) {
      return false;
    }
    const existing = this.bundles.get(name);
    if (existing) {
      existing.refs += 1;
      return true;
    }
    return false;
  }

  release(tag: string): void {
    const state = this.bundles.get(tag);
    if (!state) {
      return;
    }
    state.refs -= 1;
    if (state.refs <= 0) {
      this.bundles.delete(tag);
    }
  }

  isLoaded(tag: string): boolean {
    return this.bundles.has(tag);
  }
}

export const Res = new ResManager();
