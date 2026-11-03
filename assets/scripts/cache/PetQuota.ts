// STATUS: implemented, W23-1 小屋互动的每日次数上限（全局计数，口径与 cache/AdQuota.ts 一致）
// 计数放在 `SaveData.pettedDay` / `pettedCount`（方案 §2.1），跨自然日视为 0，因此不需要单独的重置动作。
import { Save } from './Save';
import { todayKey } from './DayKey';

export class PetQuotaStore {
  /** 今日已用次数；日期键与存档不一致时返回 0。 */
  used(dayKey: string = todayKey()): number {
    const data = Save.snapshot();
    return data.pettedDay === dayKey ? data.pettedCount : 0;
  }

  /** 剩余次数；`limit <= 0` 表示不限次，返回 null 让调用方干脆不显示计数。 */
  remaining(limit: number, dayKey: string = todayKey()): number | null {
    if (limit <= 0) {
      return null;
    }
    return Math.max(0, limit - this.used(dayKey));
  }

  /** 只读判定：次数用完时给出置灰文案，仍有余量返回 null（菜单与数据层共用同一句提示）。 */
  shortfall(actionLabel: string, limit: number, dayKey: string = todayKey()): string | null {
    const remain = this.remaining(limit, dayKey);
    return remain === null || remain > 0 ? null : `今日${actionLabel}次数已用完`;
  }

  /**
   * 只在互动真正成交后调用；上限为 0 的动作不占用计数。
   * 余量必须在 `Save.mutate` 之前算：mutate 拿到的就是同一份存档对象，先写 `pettedDay`
   * 会让随后的 `used(dayKey)` 读到昨天那 3 次，跨天时计数不归零而是接着往上加。
   */
  consume(limit: number, dayKey: string = todayKey()): void {
    if (limit <= 0) {
      return;
    }
    const next = this.used(dayKey) + 1;
    Save.mutate((data) => {
      data.pettedDay = dayKey;
      data.pettedCount = next;
    });
  }
}

export const PetQuota = new PetQuotaStore();
