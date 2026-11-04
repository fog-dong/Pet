// STATUS: implemented, W25 P2-B1 成就表结构与校验（纯函数；整表不合法即回落，不做局部修正）

export interface AchievementReward {
  coins?: number;
  hearts?: number;
  /** 限定稀有盲盒券，走已有 `items` 字段。 */
  ticket?: number;
}

export interface AchievementTier {
  need: number;
  reward: AchievementReward;
}

export interface AchievementGroup {
  id: string;
  name: string;
  /** 指标 key：`casesDone` / `reputation` 读存档字段，其余读 `counters`。 */
  metric: string;
  tiers: AchievementTier[];
}

const METRIC_PATTERN = /^[a-zA-Z][a-zA-Z0-9]*$/;
const REWARD_KEYS: readonly (keyof AchievementReward)[] = ['coins', 'hearts', 'ticket'];

function nonNegativeInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

function rewardOf(raw: unknown): AchievementReward | null {
  if (raw === undefined || raw === null) {
    return {};
  }
  if (typeof raw !== 'object') {
    return null;
  }
  const source = raw as Record<string, unknown>;
  const reward: AchievementReward = {};
  for (const key of REWARD_KEYS) {
    if (source[key] === undefined) {
      continue;
    }
    const amount = nonNegativeInt(source[key]);
    if (amount === null) {
      return null;
    }
    reward[key] = amount;
  }
  return reward;
}

function groupOf(raw: unknown): AchievementGroup | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const source = raw as Record<string, unknown>;
  const id = typeof source.id === 'string' ? source.id.trim() : '';
  const name = typeof source.name === 'string' ? source.name.trim() : '';
  const metric = typeof source.metric === 'string' ? source.metric.trim() : '';
  if (!id || !name || !metric || !METRIC_PATTERN.test(metric) || !Array.isArray(source.tiers) || source.tiers.length === 0) {
    return null;
  }
  const tiers: AchievementTier[] = [];
  for (const rawTier of source.tiers) {
    if (!rawTier || typeof rawTier !== 'object') {
      return null;
    }
    const entry = rawTier as Record<string, unknown>;
    const need = nonNegativeInt(entry.need);
    const reward = rewardOf(entry.reward);
    // 门槛必须是正整数并严格递增：并列门槛会让「下一档」失去意义。
    if (need === null || need < 1 || reward === null || (tiers.length > 0 && need <= tiers[tiers.length - 1].need)) {
      return null;
    }
    tiers.push({ need, reward });
  }
  return { id, name, metric, tiers };
}

/**
 * 整表校验：任何一组不合法就整表回落到内置兜底，不做「丢坏组留好组」的局部修正
 * （与 AgeSystem 的「阈值顺序异常整档回落」同一口径，避免线上出现半套成就）。
 */
export function normalizeGroups(raw: unknown): AchievementGroup[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [];
  }
  const groups: AchievementGroup[] = [];
  const ids = new Set<string>();
  for (const item of raw) {
    const group = groupOf(item);
    if (!group || ids.has(group.id)) {
      return [];
    }
    ids.add(group.id);
    groups.push(group);
  }
  return groups;
}
