// STATUS: implemented, W3 医院资源（药品库存 / 床位 / 好感度 / 领养位），全部落本地存档
import { Save } from '../cache/Save';

/** 每种药首次遇到时补 3 个（05 文档 §9 初值）；每日补给用等待/好友/广告占位。 */
export const DEFAULT_MEDICINE_STOCK = 3;
/** 领养位基础数量，广告或好友可临时+1。 */
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

  get bedsOwned(): number {
    return Save.snapshot().bedsOwned;
  }

  get bedsOccupied(): number {
    return Save.snapshot().bedsOccupied;
  }

  get bedFree(): boolean {
    return this.bedsOccupied < this.bedsOwned;
  }

  /** 每局开始按院内已有住院病例占床（确定性轮转，便于复现床位不足）。 */
  resetBeds(): void {
    Save.mutate((data) => {
      data.bedsOwned = Math.max(1, data.bedsOwned);
      data.bedsOccupied = data.casesDone % (data.bedsOwned + 1);
    });
  }

  admitBed(): boolean {
    let ok = false;
    Save.mutate((data) => {
      if (data.bedsOccupied < data.bedsOwned) {
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

  get slots(): number {
    return ADOPTION_BASE_SLOTS + Save.snapshot().slotBonus;
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
}

export const Hospital = new HospitalStore();
