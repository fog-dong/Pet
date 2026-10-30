// STATUS: implemented, W18-2 医院资源（等级 / 药品 / 床位 / 好感度 / 领养位），全部落本地存档
import { Save } from '../cache/Save';
import { HOSPITAL_LEVELS, HospitalLevelConfig } from './HospitalLevels';

/** 每种药首次遇到时补 3 个（05 文档 §9 初值）；每日补给在 P2 任务系统里做。 */
export const DEFAULT_MEDICINE_STOCK = 3;
/** 领养位基础数量，扩建或广告/好友可加成。 */
export const ADOPTION_BASE_SLOTS = 3;
/**
 * 领养好感门槛（06 §3.1 的 120 按单局折算为 35）：一局满分 45（诊断 15 + 治疗 20 + 对症 5 + 护理 5），
 * 低于满分就要靠分享/助力补 5，或再遇到同一只宠物累积。
 */
export const AFFECTION_THRESHOLD = 35;

export class HospitalStore {
  seedMedicines(names: readonly string[]): void {
    Save.mutate((data) => {
      for (const name of names) {
        if (data.medicines[name] === undefined) {
          data.medicines[name] = DEFAULT_MEDICINE_STOCK;
        }
      }
    });
  }

  medicineCount(name: string): number {
    return Save.snapshot().medicines[name] ?? 0;
  }

  useMedicine(name: string, count = 1): boolean {
    let ok = false;
    Save.mutate((data) => {
      const owned = data.medicines[name] ?? 0;
      if (owned >= count) {
        data.medicines[name] = owned - count;
        ok = true;
      }
    });
    return ok;
  }

  addMedicine(name: string, count = 1): void {
    if (!name || count <= 0) {
      return;
    }
    Save.mutate((data) => {
      data.medicines[name] = (data.medicines[name] ?? 0) + Math.round(count);
    });
  }

  get level(): number {
    return Save.snapshot().hospitalLevel;
  }

  get levelConfig(): HospitalLevelConfig {
    return HOSPITAL_LEVELS[Math.min(this.level, HOSPITAL_LEVELS.length) - 1];
  }

  get nextLevel(): HospitalLevelConfig | null {
    return HOSPITAL_LEVELS[this.level] ?? null;
  }

  /** 07 §3.1：床位随医院等级提升（L1 2 / L3 4 / L5 7）。 */
  get bedsOwned(): number {
    return this.levelConfig.beds;
  }

  get bedsOccupied(): number {
    return Save.snapshot().bedsOccupied;
  }

  get bedFree(): boolean {
    return this.bedsOccupied < this.bedsOwned;
  }

  /** 每局开始按院内已有住院病例占床（确定性轮转，便于复现床位不足）。 */
  resetBeds(): void {
    const beds = this.bedsOwned;
    Save.mutate((data) => {
      data.bedsOccupied = data.casesDone % (beds + 1);
    });
  }

  admitBed(): boolean {
    const beds = this.bedsOwned;
    let ok = false;
    Save.mutate((data) => {
      if (data.bedsOccupied < beds) {
        data.bedsOccupied += 1;
        ok = true;
      }
    });
    return ok;
  }

  freeBed(): void {
    Save.mutate((data) => {
      data.bedsOccupied = Math.max(0, data.bedsOccupied - 1);
    });
  }

  affection(petId: string): number {
    return Save.snapshot().affection[petId] ?? 0;
  }

  addAffection(petId: string, amount: number): void {
    if (!petId || amount <= 0) {
      return;
    }
    Save.mutate((data) => {
      data.affection[petId] = (data.affection[petId] ?? 0) + Math.round(amount);
    });
  }

  get adoptedCount(): number {
    return Save.snapshot().petsAdopted.length;
  }

  /** 06 §3.2：基础 3 位 + 等级加成 + 活动/广告临时加成。 */
  get slots(): number {
    return ADOPTION_BASE_SLOTS + this.levelConfig.slotBonus + Save.snapshot().slotBonus;
  }

  get slotFree(): boolean {
    return this.adoptedCount < this.slots;
  }

  addSlotBonus(count = 1): void {
    if (count <= 0) {
      return;
    }
    Save.mutate((data) => {
      data.slotBonus = Math.max(0, data.slotBonus + Math.round(count));
    });
  }

  /** 07 §3.1：金币是唯一扩建货币，回收点可延迟，不卡核心循环。 */
  upgrade(): boolean {
    const next = this.nextLevel;
    if (!next || !Save.spendCoins(next.cost)) {
      return false;
    }
    Save.mutate((data) => {
      data.hospitalLevel = next.level;
    });
    return true;
  }
}

export const Hospital = new HospitalStore();
