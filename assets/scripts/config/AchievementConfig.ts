// STATUS: implemented, W25 P2-B1 成就表加载（cases 分包优先 → resources 兜底；缺配/整表不合法都回落并 Track，不静默）
import { loadConfigJson } from './ConfigLoader';
import { ACHIEVEMENT_FALLBACK, TICKET_ITEM } from './AchievementDefaults';
import { AchievementGroup, normalizeGroups } from '../game/AchievementSchema';
import { Track } from '../track/Track';

interface AchievementFile {
  version: number;
  groups?: unknown;
}

class AchievementConfigStore {
  private groups: AchievementGroup[] = [...ACHIEVEMENT_FALLBACK];
  private loaded = false;

  get list(): readonly AchievementGroup[] {
    return this.groups;
  }

  /** 奖励券的落库 key：与 gacha.json 的 ticketItem 必须同值，由校验脚本钉住。 */
  get ticketItem(): string {
    return TICKET_ITEM;
  }

  get ready(): boolean {
    return this.loaded;
  }

  async load(): Promise<boolean> {
    if (this.loaded) {
      return true;
    }
    const file = await loadConfigJson<AchievementFile>('config/achievements');
    if (!file) {
      Track.track('config_missing', { key: 'achievements' });
      return false;
    }
    const groups = normalizeGroups(file.groups);
    if (groups.length === 0) {
      Track.track('config_invalid', { key: 'achievements' });
      return false;
    }
    this.groups = groups;
    this.loaded = true;
    return true;
  }
}

export const AchievementConfig = new AchievementConfigStore();
