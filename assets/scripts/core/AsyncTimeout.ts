// STATUS: implemented, W16 P0 通用超时包装（分包/网络等待超时后走兜底，不让首屏卡死）
export function withTimeout<T>(task: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    const settle = (value: T | null): void => {
      clearTimeout(timer);
      resolve(value);
    };
    task.then(settle, () => settle(null));
  });
}
