// STATUS: implemented, W25 P1-A 街头寻访抽卡配置（权重 70/25/5、花费与重复转化全部来自 gacha.json）
import { loadConfigJson } from './ConfigLoader';

export type GachaTier = 'common' | 'rare' | 'legendary';

export interface GachaDuplicate {
  coins: number;
  hearts: number;
}

export interface GachaTierConfig {
  tier: GachaTier;
  name: string;
  weight: number;
  tint?: string;
  duplicate: GachaDuplicate;
  pets: string[];
}

interface GachaFile {
  version: number;
  costCoins: number;
  adScene: string;
  tiers: GachaTierConfig[];
}

export interface GachaRoll {
  petId: string;
  tier: GachaTier;
  tierName: string;
  tint: string;
  duplicate: GachaDuplicate;
}

const TIERS: readonly GachaTier[] = ['common', 'rare', 'legendary'];

class GachaConfigStore {
  private tiers: GachaTierConfig[] = [];
  private cost = 0;
  private scene = '';

  get ready(): boolean {
    return this.tiers.length > 0;
  }

  get costCoins(): number {
    return this.cost;
  }

  get adScene(): string {
    return this.scene;
  }

  async load(): Promise<boolean> {
    if (this.ready) {
      return true;
    }
    const file = await loadConfigJson<GachaFile>('config/gacha');
    if (!file || !Array.isArray(file.tiers)) {
      return false;
    }
    this.tiers = file.tiers.filter(
      (tier) =>
        TIERS.includes(tier.tier) &&
        Array.isArray(tier.pets) &&
        tier.pets.length > 0 &&
        tier.weight > 0,
    );
    this.cost = Math.max(0, Math.round(file.costCoins));
    this.scene = file.adScene ?? '';
    return this.ready;
  }

  /** 先按档位权重抽稀有度，再从该档池子里等概率取一只。 */
  roll(): GachaRoll | null {
    const total = this.tiers.reduce((sum, tier) => sum + tier.weight, 0);
    if (total <= 0) {
      return null;
    }
    let point = Math.random() * total;
    for (const tier of this.tiers) {
      point -= tier.weight;
      if (point < 0) {
        return pick(tier);
      }
    }
    return pick(this.tiers[this.tiers.length - 1]);
  }
}

function pick(tier: GachaTierConfig): GachaRoll {
  return {
    petId: tier.pets[Math.floor(Math.random() * tier.pets.length)],
    tier: tier.tier,
    tierName: tier.name,
    tint: tier.tint ?? '',
    duplicate: { coins: tier.duplicate.coins, hearts: tier.duplicate.hearts },
  };
}

export const GachaConfig = new GachaConfigStore();
