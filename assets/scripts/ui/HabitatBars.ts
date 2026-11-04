// STATUS: implemented, W25 P0-B 小屋属性行（图标即按钮：三枚自绘矢量圆钮 + 细条数值，替掉 W20-2 的文字标签）
// 口径不变：饱食暖黄 / 清洁雾蓝 / 心情陶土，与大厅 HUD 同源；数值与消耗仍由 game/HabitatRules 决定。
// 改造点：文字标签换成热区，玩家点图标就直接做对应动作，不再先弹一层菜单（方案 §3.2）。
import { Color, Graphics, Node, UIOpacity, UITransform } from 'cc';
import { STAT_MAX } from '../cache/HabitatCodec';
import { HabitatStatKey } from '../game/HabitatRules';
import { makeLabel } from './FontKit';
import { Point } from './ParticleKit';
import { DISC_TINT, paintStatGlyph } from './HabitatGlyphs';
import { COLORS, tint } from './Tokens';

const BAR_H = 14;
/** 热区 44×44 是小 game 触摸下限；圆盘画到 42，留 1 px 呼吸。 */
const ZONE = 44;
const DISC_R = 21;
const STEP = 30;
const TRACK = new Color(233, 224, 210, 255);
/** 泡泡的描边用同色系深一档，否则浅蓝描边在米色卡上几乎看不见。 */
const BUBBLE_STROKE = tint('#5C87A6');
/** 买不起或次数用尽时降到这个透明度：不隐藏，玩家仍看得见"有这个动作，只是现在不行"。 */
export const ZONE_DIM = 92;

export const STAT_COLORS: Record<HabitatStatKey, Color> = {
  hunger: COLORS.gold,
  cleanliness: COLORS.mist,
  mood: COLORS.clay,
};
/** 卡片里三行的固定顺序，触点侧按这个键取热区。 */
export const STAT_ORDER: readonly HabitatStatKey[] = ['hunger', 'cleanliness', 'mood'];

export interface StatRow {
  update(value: number): void;
  setAffordable(affordable: boolean): void;
}

export interface StatBlock {
  rows: Record<HabitatStatKey, StatRow>;
  /** 图标热区节点，由 HabitatRows 绑触点。 */
  zones: Record<HabitatStatKey, Node>;
  /** 各热区中心在卡片局部坐标里的位置——道具抛物线的起飞点。 */
  origins: Record<HabitatStatKey, Point>;
}

/** iconX 是圆钮中心，left 是轨道左沿；顶行从 top 起，往下每行退 STEP。 */
export function addStatBlock(
  parent: Node,
  petId: string,
  iconX: number,
  left: number,
  top: number,
  barWidth: number,
): StatBlock {
  const rows = {} as Record<HabitatStatKey, StatRow>;
  const zones = {} as Record<HabitatStatKey, Node>;
  const origins = {} as Record<HabitatStatKey, Point>;
  STAT_ORDER.forEach((key, index) => {
    const y = top - index * STEP;
    const zone = addZone(parent, key, petId, iconX, y);
    const bar = addBar(parent, key, petId, left, y, barWidth);
    const opacity = zone.getComponent(UIOpacity)!;
    rows[key] = {
      update: bar.update,
      setAffordable(affordable: boolean): void {
        opacity.opacity = affordable ? 255 : ZONE_DIM;
      },
    };
    zones[key] = zone;
    origins[key] = { x: iconX, y };
  });
  return { rows, zones, origins };
}

function addZone(parent: Node, key: HabitatStatKey, petId: string, x: number, y: number): Node {
  const zone = new Node(`HabitatZone_${key}_${petId}`);
  zone.parent = parent;
  zone.setPosition(x, y, 0);
  zone.addComponent(UITransform).setContentSize(ZONE, ZONE);
  const disc = zone.addComponent(Graphics);
  disc.fillColor = DISC_TINT[key];
  disc.circle(0, 0, DISC_R);
  disc.fill();
  const icon = new Node(`${key}Glyph`);
  icon.parent = zone;
  const graphics = icon.addComponent(Graphics);
  graphics.fillColor = STAT_COLORS[key];
  graphics.strokeColor = key === 'cleanliness' ? BUBBLE_STROKE : STAT_COLORS[key];
  paintStatGlyph(key, graphics);
  zone.addComponent(UIOpacity);
  return zone;
}

function addBar(
  parent: Node,
  key: HabitatStatKey,
  petId: string,
  left: number,
  y: number,
  barWidth: number,
): { update(value: number): void } {
  const track = new Node(`HabitatTrack_${key}_${petId}`);
  track.parent = parent;
  track.setPosition(left + barWidth / 2, y, 0);
  track.addComponent(UITransform).setContentSize(barWidth, BAR_H);
  const back = track.addComponent(Graphics);
  back.fillColor = TRACK;
  back.roundRect(-barWidth / 2, -BAR_H / 2, barWidth, BAR_H, BAR_H / 2);
  back.fill();

  const fill = new Node(`${key}Fill`);
  fill.parent = track;
  fill.addComponent(UITransform).setContentSize(barWidth, BAR_H);
  const graphics = fill.addComponent(Graphics);
  const value = makeLabel(track, `HabitatValue_${key}_${petId}`, '0', 0, {
    size: 16,
    width: 60,
    x: barWidth / 2 - 32,
    color: COLORS.white,
  });

  return {
    update(raw: number): void {
      const clamped = Math.max(0, Math.min(STAT_MAX, Math.round(raw)));
      const ratio = clamped / STAT_MAX;
      graphics.clear();
      // 满值以下也要留出可见头，否则低数值读起来像"没画"。
      const width = Math.max(BAR_H, barWidth * ratio);
      graphics.fillColor = STAT_COLORS[key];
      graphics.roundRect(-barWidth / 2, -BAR_H / 2, width, BAR_H, BAR_H / 2);
      graphics.fill();
      value.string = String(clamped);
      value.color = ratio > 0.24 ? COLORS.white : COLORS.ink;
    },
  };
}
