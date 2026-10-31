// STATUS: implemented, W17-2 资源清单解析与本地副本（config.payload.resource_manifest）
import { sys } from 'cc';

export type ResourceKind = 'image' | 'audio';

export interface ResourceEntry {
  key: string;
  path: string;
  kind: ResourceKind;
  md5: string;
  size: number;
  version: number;
}

export interface ResourceManifest {
  version: number;
  files: ResourceEntry[];
}

const MANIFEST_KEY = 'pet_cloud_manifest_v1';
const MAX_FILES = 500;
const MAX_FILE_BYTES = 64 * 1024 * 1024;
const KEY_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'webp']);
const AUDIO_EXT = new Set(['mp3', 'm4a', 'aac', 'ogg', 'wav']);

export function extensionOf(path: string): string {
  const clean = path.split('?')[0].split('#')[0];
  const dot = clean.lastIndexOf('.');
  return dot >= 0 ? clean.slice(dot + 1).toLowerCase() : '';
}

function validEntry(raw: unknown): ResourceEntry | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const { key, path, kind, size, version } = record;
  if (typeof key !== 'string' || !KEY_PATTERN.test(key)) {
    return null;
  }
  if (typeof path !== 'string' || path.length > 512) {
    return null;
  }
  if (!path.startsWith('cloud://') && !path.startsWith('https://')) {
    return null;
  }
  if (kind !== 'image' && kind !== 'audio') {
    return null;
  }
  const ext = extensionOf(path);
  if (kind === 'image' ? !IMAGE_EXT.has(ext) : !AUDIO_EXT.has(ext)) {
    return null;
  }
  if (typeof size !== 'number' || !Number.isInteger(size) || size < 0 || size > MAX_FILE_BYTES) {
    return null;
  }
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return null;
  }
  const md5 = typeof record.md5 === 'string' ? record.md5.trim().toLowerCase() : '';
  if (md5 && !/^[a-f0-9]{32}$/.test(md5)) {
    return null;
  }
  return { key, path, kind, md5, size, version };
}

/** 坏条目整条跳过；清单整体非法时返回 null，调用方保持旧清单/空清单。 */
export function parseManifest(raw: unknown): ResourceManifest | null {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  const version = record.version;
  const files = record.files;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) {
    return null;
  }
  if (!Array.isArray(files) || files.length > MAX_FILES) {
    return null;
  }
  const seen = new Set<string>();
  const entries: ResourceEntry[] = [];
  for (const item of files) {
    const entry = validEntry(item);
    if (entry && !seen.has(entry.key)) {
      seen.add(entry.key);
      entries.push(entry);
    }
  }
  return { version, files: entries };
}

export function loadStoredManifest(): ResourceManifest | null {
  try {
    const raw = sys.localStorage.getItem(MANIFEST_KEY);
    return raw ? parseManifest(raw) : null;
  } catch {
    return null;
  }
}

export function storeManifest(manifest: ResourceManifest): void {
  try {
    sys.localStorage.setItem(MANIFEST_KEY, JSON.stringify(manifest));
  } catch {
    // 存档空间不足不影响线上流程，下次启动重新从 getConfig 取。
  }
}
