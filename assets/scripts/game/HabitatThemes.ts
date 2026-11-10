// STATUS: implemented, W25 P1-C 小屋装修主题表（纯数据 + 本地购买/切换；偏差 D19 只落本地存档）；W25 P2-B1 购买计数
// W31：主题表对齐 flow-mobile 设计稿 B2——四套（奶油诊室 / 樱花小筑 / 海盐午后 / 森林晨光），价格 0/320/480/640。
// 色值只存十六进制字符串，UI 侧统一走 Tokens.tint()，本文件不引用 cc，便于后续换成配置表。
import { Save } from '../cache/Save';
import { COPY, fillCopy } from '../config/CopyText';
import { bumpCounter } from './Counters';

export type HabitatThemeId = 'clinic' | 'sakura' | 'sea' | 'forest';

export interface HabitatTheme {
  id: HabitatThemeId;
  name: string;
  blurb: string;
  /** 0 表示默认拥有，不写入购买表。 */
  cost: number;
  panel: string;
  card: string;
  wall: string;
  accent: string;
  sky: string;
  floor: string;
}

export const HABITAT_THEMES: readonly HabitatTheme[] = [
  {
    id: 'clinic', name: '奶油诊室', blurb: '默认 · 暖木与米白', cost: 0,
    panel: '#FFFCF5', card: '#F9EFE2', wall: '#F3E8DA', accent: '#E4D3BE', sky: '#D9EDE4', floor: '#EFE2D2',
  },
  {
    id: 'sakura', name: '樱花小筑', blurb: '粉墙 · 樱色窗帘', cost: 320,
    panel: '#FFF6F5', card: '#FBECEA', wall: '#F7E3E2', accent: '#E9A7B8', sky: '#FBE3E8', floor: '#F3DED9',
  },
  {
    id: 'sea', name: '海盐午后', blurb: '灰蓝 · 海风窗景', cost: 480,
    panel: '#F4F9FB', card: '#E9F1F5', wall: '#E1EDF1', accent: '#7FB3C8', sky: '#CFE3EC', floor: '#DCE9EE',
  },
  {
    id: 'forest', name: '森林晨光', blurb: '浅绿 · 木质与藤', cost: 640,
    panel: '#F6F9F2', card: '#EDF2E7', wall: '#E6EDDF', accent: '#8FAE79', sky: '#DCEBCF', floor: '#DDE7D2',
  },
];

export type ThemeOutcome =
  | { kind: 'done'; theme: HabitatTheme; text: string }
  | { kind: 'blocked'; text: string };

/** 存档里的主题 id 可能来自旧版本或被改坏（旧档还有已下线的 bedroom/balcony），一律回落奶油诊室。 */
export function themeById(id: string | undefined): HabitatTheme {
  return HABITAT_THEMES.find((item) => item.id === id) ?? HABITAT_THEMES[0];
}

export function isThemeOwned(theme: HabitatTheme | string): boolean {
  const item = typeof theme === 'string' ? themeById(theme) : theme;
  if (item.cost <= 0) {
    return true;
  }
  Save.load();
  return Save.snapshot().habitatThemes.includes(item.id);
}

/**
 * 买不起还差多少金币：0 表示钱够（或已拥有）。
 * W28 P1-3：UI 据此把按钮直接画成禁用态，玩家不必点两轮确认才知道钱不够。
 */
export function themeShortfall(theme: HabitatTheme): number {
  if (isThemeOwned(theme)) {
    return 0;
  }
  return Math.max(0, theme.cost - Save.coins);
}

/** 当前生效主题：存档指向未购买的主题时回落默认，不让改档拿到付费外观。 */
export function currentHabitatTheme(): HabitatTheme {
  Save.load();
  const theme = themeById(Save.snapshot().habitatTheme);
  return isThemeOwned(theme) ? theme : HABITAT_THEMES[0];
}

export function selectHabitatTheme(id: string): ThemeOutcome {
  const theme = themeById(id);
  if (!isThemeOwned(theme)) {
    return { kind: 'blocked', text: fillCopy(COPY.habitatThemeNoCoins, { cost: theme.cost }) };
  }
  Save.mutate((data) => {
    data.habitatTheme = theme.id;
  });
  return { kind: 'done', theme, text: fillCopy(COPY.habitatThemeApplied, { name: theme.name }) };
}

/** 一次落盘完成「扣金币 + 记购买 + 切主题」，中途失败不会出现买了没用上的半状态。 */
export function buyHabitatTheme(id: string): ThemeOutcome {
  const theme = themeById(id);
  if (isThemeOwned(theme)) {
    return selectHabitatTheme(theme.id);
  }
  if (Save.coins < theme.cost) {
    return { kind: 'blocked', text: fillCopy(COPY.habitatThemeNoCoins, { cost: theme.cost }) };
  }
  Save.mutate((data) => {
    data.coins -= theme.cost;
    if (!data.habitatThemes.includes(theme.id)) {
      data.habitatThemes.push(theme.id);
    }
    data.habitatTheme = theme.id;
  });
  bumpCounter('themeBought');
  return { kind: 'done', theme, text: fillCopy(COPY.habitatThemeApplied, { name: theme.name }) };
}
