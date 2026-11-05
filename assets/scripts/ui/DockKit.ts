// STATUS: implemented, W26 P2-E 内容坞行原语：三行等分，摘要胶囊 / 主入口 / 次级入口 / 说明文字四种排法
// 行高随屏幕比例在 53–92 之间浮动，字号按行高收一档，平板比例下不会出现文字撑出胶囊的情况。
import { Button, Color, Label, Node } from 'cc';
import { makeLabel } from './FontKit';
import { lobbyDockRow, lobbyDockRowH } from './LobbyDockLayout';
import { addPill } from './PanelKit';
import { fitRow } from './ScreenMetrics';
import { COLORS } from './Tokens';
import { addUIButton } from './UIButton';

const PILL_H = 58;
const ENTRY_H = 92;
const SUB_H = 76;
const ROW_GAP = 14;
const PILL_FONT = 22;
const ENTRY_FONT = 32;
const SUB_FONT = 26;
const NOTE_FONT = 22;
const FONT_RATIO = 0.42;
const FONT_FLOOR = 18;

export interface DockSub {
  name: string;
  text: string;
  onClick: () => void;
  color?: Color;
}

/**
 * 坞递给四块内容体的上下文：入口一律回到大厅已有的 menu 分派，埋点与面板口径不另起一套。
 * changed() 由大厅负责串起 HUD、称号条与坞自身摘要，内容体不直接碰别的层。
 */
export interface DockContext {
  /** 大厅根节点：全屏遮罩类面板仍挂在它上面，坞只放摘要与入口。 */
  host: Node;
  /** 内容体可用宽度（已扣坞内边距）。 */
  width: number;
  startButton: Button | null;
  menu(name: string, focusPetId?: string): void;
  toast(text: string): void;
  changed(): void;
}

export interface DockBody {
  node: Node;
  refresh(): void;
}

/**
 * 大厅递给坞的宿主：不带宽度。可用宽度由坞自己按内边距算再注入 DockContext，
 * 避免大厅和坞各写一份 fitWidth，两边口径哪天改了不一致。
 */
export type DockHost = Omit<DockContext, 'width'>;

/** 主入口的尺寸口径：场景里的 StartButton 复用时也要按同一档排版。 */
export function dockEntrySize(): { height: number; fontSize: number } {
  const height = rowHeight(ENTRY_H);
  return { height, fontSize: fontFor(ENTRY_FONT, height) };
}

function rowHeight(cap: number): number {
  return Math.min(cap, lobbyDockRowH());
}

function fontFor(cap: number, height: number): number {
  return Math.max(FONT_FLOOR, Math.min(cap, Math.round(height * FONT_RATIO)));
}

/** 摘要胶囊一行：返回 Label 数组，调用方按位刷新文字。 */
export function addDockPills(parent: Node, texts: readonly string[], slot: number, width: number): Label[] {
  const height = rowHeight(PILL_H);
  const row = fitRow(texts.length, -width / 2, width / 2, ROW_GAP);
  return texts.map((text, index) => {
    const pill = addPill(parent, `DockPill_${slot}_${index}`, lobbyDockRow(slot), row.width, height, COLORS.paper, row.x0 + index * row.step);
    return makeLabel(pill, `DockPillText_${slot}_${index}`, text, 0, {
      size: fontFor(PILL_FONT, height),
      width: row.width - 20,
      color: COLORS.ink,
    });
  });
}

/** 主入口：一行只有一枚，占满内容坞宽度，是 TAB 里唯一的陶土色。 */
export function addDockEntry(
  parent: Node,
  name: string,
  text: string,
  onClick: () => void,
  slot: number,
  width: number,
): Button {
  const height = rowHeight(ENTRY_H);
  return addUIButton(parent, name, text, onClick, {
    y: lobbyDockRow(slot),
    width,
    height,
    color: COLORS.clay,
    fontSize: fontFor(ENTRY_FONT, height),
  });
}

/** 次级入口一行两枚：沿用 TAB 各自的 sage / mist，不再引入第四种颜色。 */
export function addDockSubs(parent: Node, subs: readonly DockSub[], slot: number, width: number): Button[] {
  const height = rowHeight(SUB_H);
  const row = fitRow(subs.length, -width / 2, width / 2, ROW_GAP);
  return subs.map((sub, index) =>
    addUIButton(parent, sub.name, sub.text, sub.onClick, {
      y: lobbyDockRow(slot),
      x: row.x0 + index * row.step,
      width: row.width,
      height,
      color: sub.color ?? COLORS.sage,
      fontSize: fontFor(SUB_FONT, height),
    }),
  );
}

/** 说明行：没有靶区的一行小字，用于库存与称号摘要。 */
export function addDockNote(parent: Node, name: string, text: string, slot: number, width: number): Label {
  return makeLabel(parent, name, text, lobbyDockRow(slot), {
    size: fontFor(NOTE_FONT, rowHeight(PILL_H)),
    width,
    color: COLORS.sub,
  });
}
