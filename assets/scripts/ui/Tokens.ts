// STATUS: implemented, W16 P0 视觉 Token（唯一口径，取值见 docs/plan/W16-视觉与交互重构方案.md §2）
import { Color } from 'cc';

/** 十六进制转不透明 Color；只接受 6 位，其余回落深棕文字色。 */
export function tint(hex: string, alpha = 255): Color {
  const value = hex.replace('#', '');
  if (value.length !== 6) {
    return new Color(74, 63, 53, alpha);
  }
  return new Color(
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
    alpha,
  );
}

/** 16 号文 §4 色板 + 派生环境色，所有页面只认这一份。 */
export const HEX = {
  cream: '#F7EFE3',
  floor: '#EFE2D2',
  wall: '#F3E8DA',
  skirt: '#D9C3A6',
  clay: '#D98E73',
  sage: '#A8C3A0',
  mist: '#A9C7D9',
  ink: '#4A3F35',
  sub: '#7B6B5E',
  paper: '#FFFCF5',
  danger: '#C97B6E',
  gold: '#E3B23C',
  shadow: '#3E322A',
} as const;

/** 共用实例：只读使用，需要改 alpha 时自行 new Color 复制。 */
export const COLORS = {
  cream: tint(HEX.cream),
  floor: tint(HEX.floor),
  wall: tint(HEX.wall),
  skirt: tint(HEX.skirt),
  clay: tint(HEX.clay),
  sage: tint(HEX.sage),
  mist: tint(HEX.mist),
  ink: tint(HEX.ink),
  sub: tint(HEX.sub),
  paper: tint(HEX.paper),
  danger: tint(HEX.danger),
  gold: tint(HEX.gold),
  white: new Color(255, 255, 255, 255),
  disabled: new Color(198, 190, 182, 255),
  disabledText: new Color(122, 114, 106, 255),
  overlay: new Color(62, 50, 42, 115),
};

export const RADIUS = { card: 16, button: 24 } as const;

export const GAP = { xs: 8, sm: 12, md: 16, lg: 24, xl: 32 } as const;

/** 动效时长（秒），见方案 §7。 */
export const DURATION = {
  press: 0.12,
  release: 0.18,
  card: 0.24,
  toastIn: 0.2,
  toastHold: 2.2,
  toastOut: 0.2,
  star: 0.26,
  starStep: 0.14,
  float: 0.9,
  fadeOut: 0.18,
  fadeIn: 0.25,
} as const;
