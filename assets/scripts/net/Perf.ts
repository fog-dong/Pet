// STATUS: implemented, W6 真机性能读数（仅 DebugPanel 使用；平台不提供时返回 0）
export function readHeapMb(): number {
  if (typeof wx === 'undefined' || typeof wx.getPerformance !== 'function') {
    return 0;
  }
  const memory = wx.getPerformance().memory;
  const used = memory ? memory.usedJSHeapSize : 0;
  return typeof used === 'number' && used > 0 ? Math.round(used / 1048576) : 0;
}
