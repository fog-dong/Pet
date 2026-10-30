// STATUS: implemented, W3 本地存档（金币/爱心/图鉴/道具/最好星级）
import { sys } from 'cc';
import { decodeSave, emptySave, SaveData } from './SaveCodec';
import { todayKey } from './DayKey';

const STORAGE_KEY = 'pet_save_v1';

export class SaveStore {
  private data: SaveData = emptySave();
  private loaded = false;

  load(): void {
    if (this.loaded) {
      return;
    }
    this.loaded = true;
    this.data = decodeSave(sys.localStorage.getItem(STORAGE_KEY));
  }

  get coins(): number {
    return this.data.coins;
  }

  get hearts(): number {
    return this.data.hearts;
  }

  get casesDone(): number {
    return this.data.casesDone;
  }

  get items(): Readonly<Record<string, number>> {
    return this.data.items;
  }

  /** 只读快照：医院资源等域模块读库存用。 */
  snapshot(): Readonly<SaveData> {
    return this.data;
  }

  /** 写入一次并落盘：域模块（药品/床位/好感度/领养位）统一走这里。 */
  mutate(apply: (data: SaveData) => void): void {
    apply(this.data);
    this.persist();
  }

  addCoins(amount: number): void {
    this.data.coins = Math.max(0, this.data.coins + Math.round(amount));
    this.persist();
  }

  spendCoins(amount: number): boolean {
    if (amount <= 0 || this.data.coins < amount) {
      return false;
    }
    this.data.coins -= amount;
    this.persist();
    return true;
  }

  addHearts(amount: number): void {
    this.data.hearts = Math.max(0, this.data.hearts + Math.round(amount));
    this.persist();
  }

  itemCount(itemId: string): number {
    return this.data.items[itemId] ?? 0;
  }

  addItem(itemId: string, count = 1): void {
    if (!itemId || count <= 0) {
      return;
    }
    this.data.items[itemId] = (this.data.items[itemId] ?? 0) + Math.round(count);
    this.persist();
  }

  useItem(itemId: string, count = 1): boolean {
    const owned = this.itemCount(itemId);
    if (!itemId || count <= 0 || owned < count) {
      return false;
    }
    this.data.items[itemId] = owned - count;
    this.persist();
    return true;
  }

  markSeen(petKey: string): void {
    if (!petKey || this.data.petsSeen.includes(petKey)) {
      return;
    }
    this.data.petsSeen.push(petKey);
    this.persist();
  }

  markAdopted(petKey: string): void {
    if (!petKey) {
      return;
    }
    if (!this.data.petsSeen.includes(petKey)) {
      this.data.petsSeen.push(petKey);
    }
    if (!this.data.petsAdopted.includes(petKey)) {
      this.data.petsAdopted.push(petKey);
    }
    if (!this.data.adoptedAt[petKey]) {
      this.data.adoptedAt[petKey] = todayKey();
    }
    this.persist();
  }

  adoptionDate(petKey: string): string {
    return this.data.adoptedAt[petKey] ?? '';
  }

  isAdopted(petKey: string): boolean {
    return this.data.petsAdopted.includes(petKey);
  }

  /** 记录最好星级，返回是否为首次通关该病例。 */
  recordStars(caseId: string, stars: number): boolean {
    const previous = this.data.bestStars[caseId] ?? 0;
    this.data.casesDone += 1;
    if (stars > previous) {
      this.data.bestStars[caseId] = stars;
    }
    this.persist();
    return previous === 0 && stars > 0;
  }

  private persist(): void {
    sys.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }
}

export const Save = new SaveStore();
