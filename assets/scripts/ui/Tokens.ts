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
  /**
   * 红点专用告警红。danger 是 terracotta，压在 clay 选中态上根本跳不出来，
   * 而红点的职责就是被看见，因此单开一档；只给红点/告警角标用，正文色仍走 danger。
   */
  alert: '#E4573D',
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

/**
 * W22-5 生命周期阶段配色：幼年浅绿 / 成年橙黄 / 老年灰蓝。
 * 三档都是 §4 色板里 sage / gold / mist 的浅化派生，文字取同色系深档保证可读性；
 * 键位与 game/AgeSystem 的 LifeStage 一一对应，新增阶段必须同步补色，不允许在 UI 里现写十六进制。
 */
export const STAGE_TINT: Record<'baby' | 'adult' | 'senior', { fill: Color; text: Color }> = {
  baby: { fill: tint('#CDE0C8'), text: tint('#4C6B49') },
  adult: { fill: tint('#F6E2AE'), text: tint('#8A6416') },
  senior: { fill: tint('#CFDCE7'), text: tint('#4E6379') },
};

/** 陪伴进度条的轨道：比卡片底色深一档，3px 高时仍能看清边界。 */
export const LIFE_TRACK = tint(HEX.skirt, 96);

export const GAP = { xs: 8, sm: 12, md: 16, lg: 24, xl: 32 } as const;

/**
 * 动效时长（秒），W16 §7 原表 + W25 Playful 档扩表（docs/plan/可玩性升级实施方案.md §4.2）。
 * Playful 身份 = 150–300ms + backOut 过冲；新增键位一律进这里，UI 侧不允许现写数字。
 */
export const DURATION = {
  press: 0.1,
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
  /** 大厅 TAB 切换：内容坞换体时的淡入 + 轻浮（P2-E 要求 0.2s，不瞬间硬切）。 */
  tabSwap: 0.2,
  /** 挤压到底（抚摸 / 道具落地）。 */
  squashIn: 0.09,
  /** 回弹过头再收住，Playful 的签名段。 */
  squashOut: 0.26,
  /** 道具抛物线单程。 */
  toss: 0.45,
  /** 起飞前的下压预备（缩到 0.94），playful 的 anticipation，不含飞行。 */
  tossAnticipate: 0.06,
  /** 洗澡时立绘的一缩一放，只做 scale 不抢粒子视线。 */
  bathNudge: 0.18,
  /** 咀嚼单次脉冲，播两次。 */
  chew: 0.12,
  /** 单颗粒子从出生到淡出。 */
  particle: 0.75,
  /** 大厅散步带入场（入场比退场长一档）。 */
  bandIn: 0.3,
  /** 小屋治愈气泡：弹出 / 停留 / 淡出。 */
  bubbleIn: 0.2,
  bubbleHold: 1.3,
  bubbleOut: 0.3,
  /** 危重红条心跳的半程（收缩→回弹各一次），整圈约 0.42s，够急但不抢操作。 */
  crisisBeat: 0.21,
} as const;
