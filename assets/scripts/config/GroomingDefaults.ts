// STATUS: implemented, W25 P2-D 护理配置的默认值（与 grooming.json 同值；缺配仍可玩并 Track 留痕）
/** 剪指甲：点 4 个红点，点错中断；金币与每日次数在开始时校验，结算时才扣。 */
export interface NailCareConfig {
  costCoins: number;
  dailyLimit: number;
  dots: number;
  /** 命中半径（设计坐标）：46 是 44 触摸下限 + 2 容错，真机觉得难点可只改这里。 */
  hitRadius: number;
  cleanGain: number;
  moodGain: number;
  wrongMoodLoss: number;
}

/** 驱虫：消耗一支后院合成的驱虫药剂，清洁 +25，每日 1 次。 */
export interface DewormConfig {
  dailyLimit: number;
  itemId: string;
  cleanGain: number;
  moodGain: number;
}

export interface GroomingData {
  nail: NailCareConfig;
  deworm: DewormConfig;
}

export const GROOMING_FALLBACK: GroomingData = {
  nail: {
    costCoins: 15,
    dailyLimit: 2,
    dots: 4,
    hitRadius: 46,
    cleanGain: 12,
    moodGain: 8,
    wrongMoodLoss: 10,
  },
  deworm: {
    dailyLimit: 1,
    itemId: 'item_deworm',
    cleanGain: 25,
    moodGain: 5,
  },
};
