// STATUS: implemented, W6 画质档位（远程配置 quality=low 时关闭循环动效与粒子抖动）
export type QualityLevel = 'high' | 'low';

let current: QualityLevel = 'high';

export const Quality = {
  get level(): QualityLevel {
    return current;
  },
  /** low 档关闭 repeatForever 类动效，降低低端机 GPU/CPU 占用。 */
  get low(): boolean {
    return current === 'low';
  },
  set(value: unknown): void {
    current = value === 'low' ? 'low' : 'high';
  },
};
