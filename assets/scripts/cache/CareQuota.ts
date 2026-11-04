// STATUS: implemented, W25 P2-D 护理每日次数（口径与 PetQuota 一致：全局计数、跨天归零、成交后才记一次）
import { todayKey } from './DayKey';
import { Save } from './Save';

export type CareKind = 'nail' | 'deworm';

export class CareQuotaStore {
  used(kind: CareKind, dayKey: string = todayKey()): number {
    const data = Save.snapshot().careQuota;
    if (data.day !== dayKey) {
      return 0;
    }
    return Math.max(0, data[kind]);
  }

  remaining(kind: CareKind, limit: number, dayKey: string = todayKey()): number | null {
    if (limit <= 0) {
      return null;
    }
    return Math.max(0, limit - this.used(kind, dayKey));
  }

  /** 次数用完给出置灰文案，仍有余量返回 null（按钮与数据层共用同一句提示）。 */
  shortfall(kind: CareKind, label: string, limit: number, dayKey: string = todayKey()): string | null {
    const remain = this.remaining(kind, limit, dayKey);
    return remain === null || remain > 0 ? null : `今日${label}次数已用完`;
  }

  /** 只在真正成交（成功或点错中断）后调用；余量必须在 `Save.mutate` 之前算。 */
  consume(kind: CareKind, limit: number, dayKey: string = todayKey()): void {
    if (limit <= 0) {
      return;
    }
    const next = this.used(kind, dayKey) + 1;
    Save.mutate((data) => {
      const nail = kind === 'nail' ? next : this.countOf(data.careQuota, 'nail', dayKey);
      const deworm = kind === 'deworm' ? next : this.countOf(data.careQuota, 'deworm', dayKey);
      data.careQuota = { day: dayKey, nail, deworm };
    });
  }

  private countOf(quota: { day: string; nail: number; deworm: number }, kind: CareKind, dayKey: string): number {
    return quota.day === dayKey ? Math.max(0, quota[kind]) : 0;
  }
}

export const CareQuota = new CareQuotaStore();
