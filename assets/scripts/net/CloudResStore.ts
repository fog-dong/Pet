// STATUS: implemented, W17-2 云资源缓存底层（文件系统/索引/LRU），供 CloudResCache 调用
import { sys } from 'cc';

export interface CacheRecord {
  path: string;
  size: number;
  version: number;
  lastUsed: number;
}

export type CacheIndex = Record<string, CacheRecord>;

const INDEX_KEY = 'pet_cloud_res_index_v1';
const CACHE_DIR = 'cloudres';
const MAX_BYTES = 32 * 1024 * 1024;
const MAX_AGE_MS = 30 * 24 * 3600 * 1000;
const DIGEST_TIMEOUT_MS = 3000;

export function getFs(): WxFileSystemManager | null {
  if (typeof wx === 'undefined' || !wx.getFileSystemManager) {
    return null;
  }
  try {
    return wx.getFileSystemManager();
  } catch {
    return null;
  }
}

function cacheRoot(): string | null {
  if (typeof wx === 'undefined' || !wx.env || !wx.env.USER_DATA_PATH) {
    return null;
  }
  return `${wx.env.USER_DATA_PATH}/${CACHE_DIR}`;
}

export function loadIndex(): CacheIndex {
  try {
    const raw = sys.localStorage.getItem(INDEX_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === 'object' ? (parsed as CacheIndex) : {};
  } catch {
    return {};
  }
}

export function saveIndex(index: CacheIndex): void {
  try {
    sys.localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    // 索引写不进去只是下次多下载一次，不影响本次可用性。
  }
}

export function sizeOf(fs: WxFileSystemManager, path: string): number {
  try {
    return fs.statSync(path).size;
  } catch {
    return -1;
  }
}

export function removeFile(fs: WxFileSystemManager, path: string): void {
  try {
    fs.unlinkSync(path);
  } catch {
    // 文件本来就不在：视为已清理。
  }
}

export function ensureDir(fs: WxFileSystemManager): string | null {
  const dir = cacheRoot();
  if (!dir) {
    return null;
  }
  try {
    fs.mkdirSync(dir, true);
  } catch {
    // 目录已存在。
  }
  return dir;
}

/** 平台支持摘要时做 MD5 校验；不支持则视为通过（调用处已有 size 校验）。 */
export function digestMatches(fs: WxFileSystemManager, path: string, md5: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean): void => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(ok);
      }
    };
    const timer = setTimeout(() => finish(true), DIGEST_TIMEOUT_MS);
    try {
      fs.getFileInfo({
        filePath: path,
        digestAlgorithm: 'md5',
        success: (result) => finish(typeof result.digest === 'string' ? result.digest.toLowerCase() === md5 : true),
        fail: () => finish(true),
      });
    } catch {
      finish(true);
    }
  });
}

export function evict(fs: WxFileSystemManager, index: CacheIndex): void {
  const now = Date.now();
  for (const key of Object.keys(index)) {
    const record = index[key];
    if (now - record.lastUsed > MAX_AGE_MS) {
      removeFile(fs, record.path);
      delete index[key];
    }
  }
  let total = 0;
  for (const key of Object.keys(index)) {
    total += Math.max(0, index[key].size);
  }
  if (total <= MAX_BYTES) {
    return;
  }
  const byAge = Object.keys(index).sort((a, b) => index[a].lastUsed - index[b].lastUsed);
  for (const key of byAge) {
    if (total <= MAX_BYTES) {
      break;
    }
    removeFile(fs, index[key].path);
    total -= Math.max(0, index[key].size);
    delete index[key];
  }
}
