// STATUS: implemented, W27 P3-UI 当前方案纸卡条（带阴影纸卡 + 三格「图标 + 值」组合，取代原来一行干瘪状态文字）
import { Label, Node } from 'cc';
import { addLabel } from './SceneUI';
import { addShadow, createBox, paintRound, sliceNode } from './PanelKit';
import { GlyphKind, addGlyphBadge, paintGlyphBadge } from './GlyphKit';
import { COLORS, HEX, RADIUS, tint } from './Tokens';
import { fitWidth } from './ScreenMetrics';

const H = 104;
const PAD = 20;
/** 药品可能叠两三种，给它近一半宽度；床位与时间各占不到三分之一。 */
const WEIGHTS = [0.44, 0.28, 0.28];
const KINDS: readonly GlyphKind[] = ['medicine', 'bed', 'time'];
const PLACEHOLDER = ['未选药', '未选床位', '未选时间'];
const BADGE = 28;
const HEAD_Y = 30;
const VALUE_Y = -20;
const BADGE_IDLE = tint('#F6E3DA');
const BADGE_DONE = tint('#B0654C');

export interface PlanStrip {
  node: Node;
  setPlan: (medicines: readonly string[], bed: string, time: string, bedUsage: string) => void;
}

export function addPlanStrip(parent: Node, y: number, width: number): PlanStrip {
  const w = fitWidth(width, 30);
  const node = createBox(parent, 'PlanStrip', y, w, H);
  addShadow(parent, node, w, H, RADIUS.card, 7, 66);
  paintRound(node, w, H, RADIUS.card, COLORS.paper);
  sliceNode(node, 'ui_panel_paper', COLORS.paper);
  // 顶部一条主色细线，把"这是当前生效的方案"和别的白卡区分开。
  paintRound(createBox(node, 'PlanStripTop', H / 2 - 4, w - 2 * PAD, 5), w - 2 * PAD, 5, 2.5, tint(HEX.clay, 130));
  addLabel(node, 'PlanTitle', '当前方案', HEAD_Y, { size: 20, color: COLORS.sub, width: 96, x: -w / 2 + PAD + 48 });
  const bedUsage = addLabel(node, 'PlanBedUsage', '', HEAD_Y, {
    size: 20,
    color: COLORS.sub,
    width: 180,
    x: w / 2 - PAD - 90,
  });
  const cells = KINDS.map((kind, index) => addSegment(node, kind, index, w));
  return {
    node,
    setPlan: (medicines, bed, time, usage) => {
      const values = [medicines.length > 0 ? medicines.join(' + ') : PLACEHOLDER[0], bed || PLACEHOLDER[1], time || PLACEHOLDER[2]];
      cells.forEach((cell, index) => {
        const picked = values[index] !== PLACEHOLDER[index];
        cell.label.string = values[index] ?? '';
        cell.label.color = picked ? COLORS.ink : COLORS.sub;
        paintGlyphBadge(cell.badge, picked ? BADGE_DONE : BADGE_IDLE, picked ? COLORS.white : COLORS.clay);
      });
      bedUsage.string = usage;
    },
  };
}

function addSegment(parent: Node, kind: GlyphKind, index: number, w: number): { label: Label; badge: Node } {
  const usable = w - 2 * PAD;
  const left = -w / 2 + PAD + WEIGHTS.slice(0, index).reduce((sum, item) => sum + item, 0) * usable;
  const cellW = WEIGHTS[index] * usable;
  const name = `PlanSeg${index}`;
  const badge = addGlyphBadge(parent, `${name}Badge`, kind, BADGE, BADGE_IDLE, COLORS.clay);
  badge.setPosition(left + BADGE / 2 + 2, VALUE_Y, 0);
  const textW = Math.max(60, cellW - BADGE - 16);
  const label = addLabel(parent, `${name}Value`, '', VALUE_Y, {
    size: 22,
    color: COLORS.sub,
    width: textW,
    x: left + BADGE + 12 + textW / 2,
    align: Label.HorizontalAlign.LEFT,
  });
  return { label, badge };
}
