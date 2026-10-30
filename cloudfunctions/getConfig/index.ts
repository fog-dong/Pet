// STATUS: implemented
// API: getConfig, see docs/plan/接口冻结清单.md §2.10
import * as cloud from 'wx-server-sdk';

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

interface CloudResponse<T> {
  code: number;
  msg: string;
  data: T | null;
  serverTime?: number;
}

interface GetConfigEvent {
  version?: unknown;
  grayTags?: unknown;
}

interface GetConfigData {
  version: number;
  configs: Record<string, unknown>;
  forceUpdate: boolean;
  minVersion: string;
}

interface ConfigDoc {
  configKey?: string;
  version?: number;
  payload?: unknown;
  status?: string;
  grayTags?: string[];
  grayPercent?: number;
}

// 与 docs/plan/数据库初始化清单.md §5 的配置种子一致；quality 为 W15-3 补入（画质远程开关）。
const CONFIG_KEYS = ['cases', 'skus', 'ad_slots', 'activities', 'affection', 'collection', 'quality'];
const MAX_CONFIG_DOCS = 100;

function ok<T>(data: T): CloudResponse<T> {
  return { code: 0, msg: 'ok', data, serverTime: Date.now() };
}

function fail<T>(code: number, msg: string): CloudResponse<T> {
  return { code, msg, data: null, serverTime: Date.now() };
}

function bucketOf(openid: string): number {
  let hash = 0;
  for (let index = 0; index < openid.length; index += 1) {
    hash = (hash * 31 + openid.charCodeAt(index)) % 100;
  }
  return hash;
}

function isEligible(doc: ConfigDoc, tags: ReadonlySet<string>, openid: string): boolean {
  const grayTags = Array.isArray(doc.grayTags) ? doc.grayTags : [];
  const percent = typeof doc.grayPercent === 'number' ? doc.grayPercent : 0;
  if (grayTags.length === 0) {
    return percent >= 100;
  }
  if (grayTags.some((tag) => tags.has(tag))) {
    return true;
  }
  return bucketOf(openid) < percent;
}

function readTags(raw: unknown): string[] | null {
  if (raw === undefined) {
    return [];
  }
  if (!Array.isArray(raw)) {
    return null;
  }
  const tags: string[] = [];
  for (const tag of raw) {
    if (typeof tag !== 'string') {
      return null;
    }
    tags.push(tag);
  }
  return tags;
}

function pickLatest(docs: ConfigDoc[]): Map<string, ConfigDoc> {
  const latest = new Map<string, ConfigDoc>();
  for (const doc of docs) {
    const key = doc.configKey;
    if (typeof key !== 'string' || !CONFIG_KEYS.includes(key)) {
      continue;
    }
    const previous = latest.get(key);
    if (!previous || (doc.version ?? -1) > (previous.version ?? -1)) {
      latest.set(key, doc);
    }
  }
  return latest;
}

export async function main(event: GetConfigEvent): Promise<CloudResponse<GetConfigData>> {
  if (event.version !== undefined && (typeof event.version !== 'number' || !Number.isInteger(event.version) || event.version < 0)) {
    return fail<GetConfigData>(1002, 'INVALID_PARAM');
  }

  const tags = readTags(event.grayTags);
  if (!tags) {
    return fail<GetConfigData>(1002, 'INVALID_PARAM');
  }

  const { OPENID } = cloud.getWXContext();
  const result = await cloud
    .database()
    .collection<ConfigDoc>('config')
    .where({ status: 'active' })
    .limit(MAX_CONFIG_DOCS)
    .get();
  const latest = pickLatest(result.data);

  let version = 0;
  for (const doc of latest.values()) {
    version = Math.max(version, doc.version ?? 0);
  }

  if (typeof event.version === 'number' && event.version === version) {
    return ok<GetConfigData>({ version, configs: {}, forceUpdate: false, minVersion: '0.0.0' });
  }

  const tagSet = new Set<string>(tags);
  const configs: Record<string, unknown> = {};
  for (const [key, doc] of latest) {
    if (isEligible(doc, tagSet, OPENID ?? '')) {
      configs[key] = doc.payload ?? null;
    }
  }

  // minVersion/forceUpdate 依赖运营配置，当前无 active 配置源，返回安全默认值。
  return ok<GetConfigData>({ version, configs, forceUpdate: false, minVersion: '0.0.0' });
}
