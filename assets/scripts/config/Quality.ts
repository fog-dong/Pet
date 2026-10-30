// STATUS: implemented, W6 画质档位（远程配置 quality=low 时关闭循环动效与粒子抖动）；W15-3 支持运行时切换
export type QualityLevel = 'high' | 'low';

type QualityListener = (low: boolean) => void;

let current: QualityLevel = 'high';
const listeners = new Set<QualityListener>();

export const Quality = {
  get level(): QualityLevel {
    return current;
  },
  /** low 档关闭 repeatForever 类动效，降低低端机 GPU/CPU 占用。 */
  get low(): boolean {
    return current === 'low';
  },
  /** 值变化才通知，已经在播的循环动效由订阅方按新档位收尾或恢复。 */
  set(value: unknown): void {
    const next: QualityLevel = value === 'low' ? 'low' : 'high';
    if (next === current) {
      return;
    }
    current = next;
    for (const listener of listeners) {
      listener(current === 'low');
    }
  },
  /** 返回退订函数：视图在 onDisable/销毁时调用，避免切场景后残留回调。 */
  subscribe(listener: QualityListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
