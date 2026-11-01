// STATUS: implemented, W20-2 小屋属性细条（14px 圆角轨道 + 分段填色 + 右侧数值，随存档刷新）
import { Color, Graphics, Node, UITransform } from 'cc';
import { STAT_MAX } from '../cache/HabitatCodec';
import { makeLabel } from './FontKit';
import { COLORS } from './Tokens';

const BAR_H = 14;
const TRACK = new Color(233, 224, 210, 255);

/** 饱食走暖黄、清洁走雾蓝、心情走陶土粉，与大厅 HUD 同源，不引入第二套色。 */
export const STAT_COLORS = { hunger: COLORS.gold, cleanliness: COLORS.mist, mood: COLORS.clay };

export interface StatRow {
  update(value: number): void;
}

/** left 是轨道左沿的 x，文字贴在轨道左边 8px，数值贴在轨道右端内侧。 */
export function addStatRow(
  parent: Node,
  name: string,
  text: string,
  left: number,
  y: number,
  barWidth: number,
  color: Color,
): StatRow {
  makeLabel(parent, `${name}Text`, text, y, { size: 20, width: 88, x: left - 52, color: COLORS.sub });
  const track = new Node(`${name}Track`);
  track.parent = parent;
  track.setPosition(left + barWidth / 2, y, 0);
  track.addComponent(UITransform).setContentSize(barWidth, BAR_H);
  const back = track.addComponent(Graphics);
  back.fillColor = TRACK;
  back.roundRect(-barWidth / 2, -BAR_H / 2, barWidth, BAR_H, BAR_H / 2);
  back.fill();

  const fill = new Node(`${name}Fill`);
  fill.parent = track;
  fill.addComponent(UITransform).setContentSize(barWidth, BAR_H);
  const graphics = fill.addComponent(Graphics);

  const value = makeLabel(track, `${name}Value`, '0', 0, { size: 16, width: 60, color: COLORS.white });

  return {
    update(raw: number): void {
      const clamped = Math.max(0, Math.min(STAT_MAX, Math.round(raw)));
      const ratio = clamped / STAT_MAX;
      graphics.clear();
      // 满值以下也要留出可见头，否则低数值读起来像“没画”。
      const width = Math.max(BAR_H, barWidth * ratio);
      graphics.fillColor = color;
      graphics.roundRect(-barWidth / 2, -BAR_H / 2, width, BAR_H, BAR_H / 2);
      graphics.fill();
      value.string = String(clamped);
      value.color = ratio > 0.24 ? COLORS.white : COLORS.ink;
    },
  };
}

/** 一列三行：小屋卡片右侧统一用它，顺序固定为饱食/清洁/心情。 */
export function addStatColumns(
  parent: Node,
  name: string,
  left: number,
  top: number,
  barWidth: number,
): Record<'hunger' | 'cleanliness' | 'mood', StatRow> {
  const step = 30;
  return {
    hunger: addStatRow(parent, `${name}Hunger`, '饱食', left, top, barWidth, STAT_COLORS.hunger),
    cleanliness: addStatRow(parent, `${name}Clean`, '清洁', left, top - step, barWidth, STAT_COLORS.cleanliness),
    mood: addStatRow(parent, `${name}Mood`, '心情', left, top - step * 2, barWidth, STAT_COLORS.mood),
  };
}
