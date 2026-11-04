// STATUS: implemented, W25 P2-D 护理配置加载（grooming.json 为唯一数值口径；缺配/非法回落内置同值并 Track）
import { loadConfigJson } from './ConfigLoader';
import { DewormConfig, GROOMING_FALLBACK, GroomingData, NailCareConfig } from './GroomingDefaults';
import { Track } from '../track/Track';

interface GroomingFile {
  version?: number;
  nail?: Partial<Record<keyof NailCareConfig, unknown>>;
  deworm?: Partial<Record<keyof DewormConfig, unknown>>;
}

function intOf(value: unknown, fallback: number, min = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.floor(value));
}

function textOf(value: unknown, fallback: string): string {
  return typeof value === 'string' && value ? value : fallback;
}

class GroomingConfigStore {
  private data: GroomingData = GROOMING_FALLBACK;
  private ready = false;

  get nail(): NailCareConfig {
    return this.data.nail;
  }

  get deworm(): DewormConfig {
    return this.data.deworm;
  }

  get loaded(): boolean {
    return this.ready;
  }

  async load(): Promise<boolean> {
    if (this.ready) {
      return true;
    }
    const file = await loadConfigJson<GroomingFile>('config/grooming');
    if (!file) {
      Track.track('config_missing', { key: 'grooming' });
      return false;
    }
    const nail = file.nail ?? {};
    const deworm = file.deworm ?? {};
    this.data = {
      nail: {
        costCoins: intOf(nail.costCoins, GROOMING_FALLBACK.nail.costCoins),
        dailyLimit: intOf(nail.dailyLimit, GROOMING_FALLBACK.nail.dailyLimit),
        // 红点少于 1 个就没法玩，至少保留 1 个。
        dots: intOf(nail.dots, GROOMING_FALLBACK.nail.dots, 1),
        hitRadius: intOf(nail.hitRadius, GROOMING_FALLBACK.nail.hitRadius, 1),
        cleanGain: intOf(nail.cleanGain, GROOMING_FALLBACK.nail.cleanGain),
        moodGain: intOf(nail.moodGain, GROOMING_FALLBACK.nail.moodGain),
        wrongMoodLoss: intOf(nail.wrongMoodLoss, GROOMING_FALLBACK.nail.wrongMoodLoss),
      },
      deworm: {
        dailyLimit: intOf(deworm.dailyLimit, GROOMING_FALLBACK.deworm.dailyLimit),
        itemId: textOf(deworm.itemId, GROOMING_FALLBACK.deworm.itemId),
        cleanGain: intOf(deworm.cleanGain, GROOMING_FALLBACK.deworm.cleanGain),
        moodGain: intOf(deworm.moodGain, GROOMING_FALLBACK.deworm.moodGain),
      },
    };
    this.ready = true;
    return true;
  }
}

export const GroomingConfig = new GroomingConfigStore();
