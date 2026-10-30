// STATUS: implemented, W3 本地存档（金币/爱心/图鉴/最好星级）
import { sys } from 'cc';

const STORAGE_KEY = 'pet_save_v1';

interface SaveData {
  coins: number;
  hearts: number;
  petsSeen: string[];
  petsAdopted: string[];
  bestStars: Record<string, number>;
  casesDone: number;
}

function emptySave(): SaveData {
  return { coins: 0, hearts: 0, petsSeen: [], petsAdopted: [], bestStars: {}, casesDone: 0 };
}

function toNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function toStarMap(value: unknown): Record<string, number> {
  const result: Record<string, number> = {};
  if (!value || typeof value !== 'object') {
    return result;
  }
  const source = value as Record<string, unknown>;
  for (const key in source) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      continue;
    }
    const raw = source[key];
    if (typeof raw === 'number') {
      result[key] = raw;
    }
  }
  return result;
}

export class SaveStore {
  private data: SaveData = emptySave();
  private loaded = false;

  load(): void {
    if (this.loaded) {
      return;
    }
    this.loaded = true;
    const raw = sys.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      this.data = {
        coins: toNumber(parsed.coins, 0),
        hearts: toNumber(parsed.hearts, 0),
        petsSeen: toStringArray(parsed.petsSeen),
        petsAdopted: toStringArray(parsed.petsAdopted),
        bestStars: toStarMap(parsed.bestStars),
        casesDone: toNumber(parsed.casesDone, 0),
      };
    } catch {
      this.data = emptySave();
    }
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
    this.persist();
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
