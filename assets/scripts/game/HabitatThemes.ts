// STATUS: implemented, W25 P1-C 小屋装修主题表（纯数据 + 本地购买/切换；偏差 D19 只落本地存档）；W25 P2-B1 购买计数
// 色值只存十六进制字符串，UI 侧统一走 Tokens.tint()，本文件不引用 cc，便于后续换成配置表。
import { Save } from '../cache/Save';
import { COPY, fillCopy } from '../config/CopyText';
import { bumpCounter } from './Counters';

export type HabitatThemeId = 'clinic' | 'bedroom' | 'balcony';

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
    id: 'clinic', name: '默认诊所', blurb: '干净的诊室，薄荷色的墙', cost: 0,
    panel: '#FFFCF5', card: '#F9EFE2', wall: '#E8F1E9', accent: '#A8C3A0', sky: '#D9EDE4', floor: '#DCE7DD',
  },
  {
    id: 'bedroom', name: '温馨卧室', blurb: '暖橘夜灯，适合赖床的午后', cost: 200,
    panel: '#FFF7F2', card: '#FBEDE8', wall: '#F5DED5', accent: '#D98E73', sky: '#46506B', floor: '#EBD5C8',
  },
  {
    id: 'balcony', name: '阳光阳台', blurb: '晒太阳专用，风里有青草味', cost: 500,
    panel: '#FFFDF3', card: '#EFF7E9', wall: '#E4F2F7', accent: '#E3B23C', sky: '#BEE4F3', floor: '#E8E3C8',
  },
];

export type ThemeOutcome =
  | { kind: 'done'; theme: HabitatTheme; text: string }
  | { kind: 'blocked'; text: string };

/** 存档里的主题 id 可能来自旧版本或被改坏，一律回落到默认诊所。 */
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
