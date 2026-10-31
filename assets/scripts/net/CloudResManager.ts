// STATUS: implemented, W17-2 云存储资源统一入口（清单 → 本地缓存 → 按需下载 → SpriteFrame）
import { SpriteFrame } from 'cc';
import { Track } from '../track/Track';
import { fetchToCache, lookup, clearCache as clearCachedFiles } from './CloudResCache';
import { loadSpriteFrameFromFile } from './CloudResImage';
import {
  loadStoredManifest,
  parseManifest,
  ResourceEntry,
  ResourceManifest,
  storeManifest,
} from './CloudResManifest';

const MAX_FAILS_PER_KEY = 3;

class CloudResManagerImpl {
  private manifest: ResourceManifest | null = loadStoredManifest();
  private readonly byKey = new Map<string, ResourceEntry>();
  private readonly failures = new Map<string, number>();

  constructor() {
    this.index(this.manifest);
  }

  /** 当前清单版本；-1 表示尚未拿到清单（无网/未同意隐私均属正常）。 */
  get version(): number {
    return this.manifest ? this.manifest.version : -1;
  }

  get ready(): boolean {
    return this.manifest !== null;
  }

  get entryCount(): number {
    return this.byKey.size;
  }

  /** getConfig 返回后调用；非法清单保持原状，不阻塞任何流程。 */
  setManifest(raw: unknown): void {
    if (raw === undefined || raw === null) {
      return;
    }
    const parsed = parseManifest(raw);
    if (!parsed) {
      Track.track('cloud_res_manifest_invalid');
      return;
    }
    const previous = this.manifest ? this.manifest.version : -1;
    this.manifest = parsed;
    this.index(parsed);
    this.failures.clear();
    storeManifest(parsed);
    if (previous !== parsed.version) {
      Track.track('cloud_res_manifest', { version: parsed.version, files: parsed.files.length });
    }
  }

  entry(key: string): ResourceEntry | null {
    return this.byKey.get(key) ?? null;
  }

  /** 优先命中本地缓存；未命中才下载。返回本地路径，失败为 null。 */
  async ensure(key: string): Promise<string | null> {
    const entry = this.entry(key);
    if (!entry) {
      return null;
    }
    const cached = lookup(entry);
    if (cached) {
      return cached;
    }
    if ((this.failures.get(key) ?? 0) >= MAX_FAILS_PER_KEY) {
      return null;
    }
    const path = await fetchToCache(entry);
    if (path) {
      this.failures.delete(key);
      Track.track('cloud_res_ready', { key, version: entry.version });
      return path;
    }
    const count = (this.failures.get(key) ?? 0) + 1;
    this.failures.set(key, count);
    Track.track('cloud_res_failed', { key, count });
    return null;
  }

  /** 宠物立绘等图片资源：下载并解码；任一步失败返回 null，调用方保留占位。 */
  async loadSpriteFrame(key: string): Promise<SpriteFrame | null> {
    const entry = this.entry(key);
    if (!entry || entry.kind !== 'image') {
      return null;
    }
    const path = await this.ensure(key);
    if (!path) {
      return null;
    }
    const frame = await loadSpriteFrameFromFile(path);
    if (!frame) {
      Track.track('cloud_res_image_invalid', { key });
    }
    return frame;
  }

  /** 只清缓存文件，不清清单；供“清理缓存”入口或排障使用。 */
  clearCache(): void {
    this.failures.clear();
    clearCachedFiles();
  }

  private index(manifest: ResourceManifest | null): void {
    this.byKey.clear();
    if (!manifest) {
      return;
    }
    for (const entry of manifest.files) {
      this.byKey.set(entry.key, entry);
    }
  }
}

export const CloudResManager = new CloudResManagerImpl();
export type { ResourceEntry, ResourceManifest } from './CloudResManifest';
