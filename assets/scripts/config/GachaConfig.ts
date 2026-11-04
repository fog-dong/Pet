// STATUS: implemented, W25 P1-A 街头寻访抽卡配置（权重 70/25/5、花费与重复转化全部来自 gacha.json）；W25 P2-B1 增盲盒券兑换口径
import { loadConfigJson } from './ConfigLoader';
import { TICKET_ITEM } from './AchievementDefaults';

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
  /** 券兑换用的道具 key，缺省或非法时回落到 AchievementDefaults.TICKET_ITEM。 */
  ticketItem?: string;
  /** 券能开出的档位；缺省或全非法时回落到 rare + legendary。 */
  ticketTiers?: string[];
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
const DEFAULT_TICKET_TIERS: readonly GachaTier[] = ['rare', 'legendary'];

class GachaConfigStore {
  private tiers: GachaTierConfig[] = [];
  private cost = 0;
  private scene = '';
  private ticket = TICKET_ITEM;
  private ticketPool: GachaTier[] = [...DEFAULT_TICKET_TIERS];

  get ready(): boolean {
    return this.tiers.length > 0;
  }

  get costCoins(): number {
    return this.cost;
  }

  get adScene(): string {
    return this.scene;
  }

  get ticketItem(): string {
    return this.ticket;
  }

  get ticketTiers(): readonly GachaTier[] {
    return this.ticketPool;
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
    if (typeof file.ticketItem === 'string' && file.ticketItem.trim()) {
      this.ticket = file.ticketItem.trim();
    }
    const wanted = Array.isArray(file.ticketTiers)
      ? file.ticketTiers.filter((tier): tier is GachaTier => TIERS.includes(tier as GachaTier))
      : [];
    // 空集会让券永远开不出东西；与「非法即回落」同口径，不保留半套。
    // 去重不用 Set 展开：构建把 `[...new Set(x)]` 编成 `[].concat(new Set(x))`，concat 不拆 Set。
    const unique = wanted.filter((tier, index) => wanted.indexOf(tier) === index);
    this.ticketPool = unique.length > 0 ? unique : [...DEFAULT_TICKET_TIERS];
    return this.ready;
  }

  /** 送养感谢金按档位定价：宠物不在任何档位池里时返回 null，由调用方拒收而不是按普通档发钱。 */
  tierOf(petId: string): GachaTier | null {
    const tier = this.tiers.find((item) => item.pets.indexOf(petId) >= 0);
    return tier ? tier.tier : null;
  }

  /** 送养面板展示用：档位名来自 gacha.json，找不到时返回空串由调用方省略。 */
  tierNameOf(petId: string): string {
    const tier = this.tiers.find((item) => item.pets.indexOf(petId) >= 0);
    return tier ? tier.name : '';
  }

  /** 先按档位权重抽稀有度，再从该档池子里等概率取一只；传 only 时只在指定档位里按相对权重抽。 */
  roll(only?: readonly GachaTier[]): GachaRoll | null {
    const pool =
      only && only.length > 0 ? this.tiers.filter((tier) => only.includes(tier.tier)) : this.tiers;
    const total = pool.reduce((sum, tier) => sum + tier.weight, 0);
    if (total <= 0) {
      return null;
    }
    let point = Math.random() * total;
    for (const tier of pool) {
      point -= tier.weight;
      if (point < 0) {
        return pick(tier);
      }
    }
    return pick(pool[pool.length - 1]);
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
