// STATUS: implemented, W17-2 云资源命中/下载/清理（清单条目 → 本地路径）
import { extensionOf, ResourceEntry } from './CloudResManifest';
import {
  ensureDir,
  digestMatches,
  evict,
  getFs,
  loadIndex,
  removeFile,
  saveIndex,
  sizeOf,
} from './CloudResStore';

const DOWNLOAD_TIMEOUT_MS = 15000;

function download(fileID: string): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (path: string | null): void => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(path);
      }
    };
    const timer = setTimeout(() => finish(null), DOWNLOAD_TIMEOUT_MS);
    wx.cloud
      .downloadFile({ fileID })
      .then((result) => finish(result && typeof result.tempFilePath === 'string' ? result.tempFilePath : null))
      .catch(() => finish(null));
  });
}

/** 命中要求：版本一致、大小一致、文件仍在；返回本地路径并刷新 lastUsed。 */
export function lookup(entry: ResourceEntry): string | null {
  const fs = getFs();
  if (!fs) {
    return null;
  }
  const index = loadIndex();
  const record = index[entry.key];
  if (!record || record.version !== entry.version || record.size !== entry.size) {
    return null;
  }
  if (sizeOf(fs, record.path) !== entry.size) {
    delete index[entry.key];
    saveIndex(index);
    return null;
  }
  record.lastUsed = Date.now();
  saveIndex(index);
  return record.path;
}

/** 下载 → 校验 size/MD5 → 写入缓存目录 → 更新索引并淘汰；任一步失败返回 null。 */
export async function fetchToCache(entry: ResourceEntry): Promise<string | null> {
  const fs = getFs();
  const dir = fs ? ensureDir(fs) : null;
  if (!fs || !dir || typeof wx === 'undefined' || !wx.cloud || !wx.cloud.downloadFile) {
    return null;
  }
  const temp = await download(entry.path);
  if (!temp) {
    return null;
  }
  const tempSize = sizeOf(fs, temp);
  if (tempSize < 0 || (entry.size > 0 && tempSize !== entry.size)) {
    removeFile(fs, temp);
    return null;
  }
  if (entry.md5 && !(await digestMatches(fs, temp, entry.md5))) {
    removeFile(fs, temp);
    return null;
  }
  const target = `${dir}/${entry.key}_v${entry.version}.${extensionOf(entry.path)}`;
  removeFile(fs, target);
  let saved = false;
  try {
    fs.copyFileSync(temp, target);
    saved = true;
  } catch {
    saved = false;
  }
  if (!saved) {
    try {
      saved = fs.saveFileSync(temp, target).length > 0;
    } catch {
      saved = false;
    }
  }
  if (!saved) {
    return null;
  }
  const finalSize = sizeOf(fs, target);
  if (finalSize < 0 || (entry.size > 0 && finalSize !== entry.size)) {
    removeFile(fs, target);
    return null;
  }
  const index = loadIndex();
  index[entry.key] = { path: target, size: finalSize, version: entry.version, lastUsed: Date.now() };
  evict(fs, index);
  saveIndex(index);
  return target;
}

export function clearCache(): void {
  const fs = getFs();
  if (!fs) {
    return;
  }
  const index = loadIndex();
  for (const key of Object.keys(index)) {
    removeFile(fs, index[key].path);
  }
  saveIndex({});
}
