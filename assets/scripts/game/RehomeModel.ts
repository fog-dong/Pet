// STATUS: implemented, W25 P2-D 送养编排（提交/跳过/领结果；M1：成功即移出小屋并写入 rehomed）
import { RehomeReview } from '../cache/RehomeCodec';
import { Save } from '../cache/Save';
import { bumpCounter, counterValue } from './Counters';
import { RehomeConfig } from '../config/RehomeConfig';
import { GachaConfig } from '../config/GachaConfig';
import { Hospital } from './Hospital';
import { habitatList } from './HabitatModel';
import { careScore, passRate, thanksCoins } from './RehomeRules';

export interface RehomeQuote {
  petId: string;
  /** 通过率 0-1，UI 必须展示；低于 0.7 时额外提示照护度不足。 */
  rate: number;
  /** 按当前照护度与世代算出的感谢金，提交与领结果用的是同一套公式。 */
  thanks: number;
  tierBase: number;
}

export type RehomeStart =
  | { kind: 'started'; review: RehomeReview }
  | { kind: 'blocked'; text: string };

export type RehomeClaim =
  | { kind: 'adopted'; petId: string; coins: number; rate: number; generation: number }
  | { kind: 'rejected'; petId: string; rate: number }
  | { kind: 'blocked'; text: string };

/** 照护度与感谢金都按当前存档现算；宠物已不在小屋（或不在档位池）时返回 null。 */
export function rehomeQuote(petId: string): RehomeQuote | null {
  const entry = habitatList().find((item) => item.petId === petId);
  const tier = GachaConfig.tierOf(petId);
  if (!entry || !tier) {
    return null;
  }
  const config = RehomeConfig.value;
  const rate = passRate(careScore(entry), config.rate);
  const tierBase = config.thanks[tier];
  const thanks = thanksCoins(tierBase, Hospital.affection(petId), counterValue('rehomeCount'), config);
  return { petId, rate, thanks, tierBase };
}

export function pendingReview(): RehomeReview | null {
  return Save.snapshot().rehome.review;
}

export function reviewLeftMs(now: number = Date.now()): number {
  const review = pendingReview();
  return review ? Math.max(0, review.readyAt - now) : 0;
}

/** 提交审核：先验状态与余额，通过后扣费并落盘；同一时间只允许一只在审。 */
export function startRehome(petId: string, pay: 'coins' | 'hearts'): RehomeStart {
  const quote = rehomeQuote(petId);
  if (!quote) {
    return { kind: 'blocked', text: '这只宠物不在小屋里' };
  }
  if (pendingReview()) {
    return { kind: 'blocked', text: '已有一只宠物在等审核结果' };
  }
  const config = RehomeConfig.value;
  const need = pay === 'coins' ? config.cost.coins : config.cost.hearts;
  const shortfall = pay === 'coins' ? Save.coins < need : Save.hearts < need;
  if (shortfall) {
    return { kind: 'blocked', text: `${pay === 'coins' ? '金币' : '爱心'}不足（需 ${need}）` };
  }
  if (pay === 'coins' ? !Save.spendCoins(need) : !Save.spendHearts(need)) {
    return { kind: 'blocked', text: `${pay === 'coins' ? '金币' : '爱心'}不足（需 ${need}）` };
  }
  const review: RehomeReview = { petId, readyAt: Date.now() + config.reviewMs, rate: quote.rate };
  Save.mutate((data) => {
    data.rehome.review = review;
  });
  return { kind: 'started', review };
}

/** 3 爱心跳过等待：扣费后立即结算，与到点领结果走同一个掷骰函数。 */
export function skipReview(): RehomeClaim {
  const review = pendingReview();
  if (!review) {
    return { kind: 'blocked', text: '没有待审核的送养' };
  }
  const need = RehomeConfig.value.cost.skipHearts;
  if (!Save.spendHearts(need)) {
    return { kind: 'blocked', text: `爱心不足（需 ${need}）` };
  }
  return settle(review, true);
}

/** 到点领结果；未到点只返回剩余时间，不扣任何东西。 */
export function claimReview(now: number = Date.now()): RehomeClaim {
  const review = pendingReview();
  if (!review) {
    return { kind: 'blocked', text: '没有待审核的送养' };
  }
  if (now < review.readyAt) {
    return { kind: 'blocked', text: `审核中，还需 ${waitText(review.readyAt - now)}` };
  }
  return settle(review, false);
}

/** 掷骰只在这里发生：成功才移出小屋并记入 rehomed，失败只清审核、宠物留在原地。 */
function settle(review: RehomeReview, forced: boolean): RehomeClaim {
  if (!forced) {
    const entry = habitatList().find((item) => item.petId === review.petId);
    if (!entry) {
      Save.mutate((data) => {
        data.rehome.review = null;
      });
      return { kind: 'blocked', text: '这只宠物已经不在小屋里' };
    }
  }
  const passed = Math.random() < review.rate;
  if (!passed) {
    Save.mutate((data) => {
      data.rehome.review = null;
    });
    return { kind: 'rejected', petId: review.petId, rate: review.rate };
  }
  const tier = GachaConfig.tierOf(review.petId);
  const config = RehomeConfig.value;
  const generation = counterValue('rehomeCount');
  const coins = thanksCoins(tier ? config.thanks[tier] : config.thanks.common, Hospital.affection(review.petId), generation, config);
  Save.mutate((data) => {
    data.coins += coins;
    data.habitat = data.habitat.filter((item) => item.petId !== review.petId);
    if (data.rehome.rehomed.indexOf(review.petId) < 0) {
      data.rehome.rehomed.push(review.petId);
    }
    data.rehome.review = null;
  });
  bumpCounter('rehomeCount');
  bumpCounter('rehomeCoins', coins);
  return { kind: 'adopted', petId: review.petId, coins, rate: review.rate, generation };
}

function waitText(ms: number): string {
  const minutes = Math.ceil(Math.max(0, ms) / 60000);
  if (minutes < 60) {
    return `${minutes} 分钟`;
  }
  const rest = minutes % 60;
  return rest > 0 ? `${Math.floor(minutes / 60)} 小时 ${rest} 分钟` : `${Math.floor(minutes / 60)} 小时`;
}
