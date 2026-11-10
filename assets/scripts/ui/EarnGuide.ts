// STATUS: implemented, W27 P3-UI 模块三 资源不足指引条：面板里置灰按钮下方的可点胶囊，点一下就送到能马上拿到钱的地方
import { Button, Graphics, Node } from 'cc';
import { claimableAchievements } from '../game/Achievements';
import { EarnKind, EarnRoute, earnRoute } from '../game/EarnRoutes';
import { countRehomeReady } from '../game/LobbyAlerts';
import { pendingReview } from '../game/RehomeModel';
import { Track } from '../track/Track';
import { drawGlyph } from './GlyphKit';
import { addLabel, createNode } from './SceneUI';
import { fitWidth } from './ScreenMetrics';
import { bindPressEffect } from './UIButton';
import { HEX, COLORS, tint } from './Tokens';
import type { LobbyTab } from './LobbyTabs';

const GUIDE_W = 520;
const GUIDE_H = 48;
const INSET = 16;
const ICON = 26;
const GLYPH = { coins: 'coin', hearts: 'heart', medicine: 'sprout' } as const;

/**
 * 跳转手柄由大厅注册（它才知道 TAB 坞在哪）：面板只说"送到哪一格"，不认识坞的实现。
 * 没注册时指引条仍然显示文案，只是点了不跳——单测场景与旧调用点不会炸。
 */
let jump: ((tab: LobbyTab) => void) | null = null;

export function setEarnJumpHandler(handler: ((tab: LobbyTab) => void) | null): void {
  jump = handler;
}

/** 取数口径与大厅红点完全一致：能当场领的先领，否则回接诊主产出线。 */
export function quickEarnRoute(kind: EarnKind): EarnRoute {
  return earnRoute(kind, {
    claimable: claimableAchievements(),
    rehomeReady: countRehomeReady(pendingReview(), Date.now()),
  });
}

/** dismiss 先关当前面板，再跳到目标 TAB，避免落地时两块遮罩叠在一起。 */
export function addEarnGuide(
  parent: Node,
  y: number,
  kind: EarnKind,
  dismiss: () => void,
  name = 'EarnGuide',
  width = GUIDE_W,
): Node {
  return renderEarnGuide(parent, y, quickEarnRoute(kind), kind, dismiss, name, width);
}

export function renderEarnGuide(
  parent: Node,
  y: number,
  route: EarnRoute,
  kind: EarnKind,
  dismiss: () => void,
  name = 'EarnGuide',
  width = GUIDE_W,
): Node {
  const fitted = fitWidth(width, 90);
  const row = createNode(parent, name, y, fitted, GUIDE_H);
  const graphics = row.addComponent(Graphics);
  paint(graphics, fitted);
  // 底与图标共用一张 Graphics：同节点挂两个 Graphics 组件在 3.8 里排序不稳定。
  drawGlyph(graphics, GLYPH[kind], -fitted / 2 + INSET + ICON / 2, 0, ICON, tint(HEX.gold));
  addLabel(row, `${name}Text`, route.text, 0, {
    size: 20,
    color: tint('#8A6416'),
    width: fitted - INSET * 2 - ICON - 16,
    x: (ICON + 16) / 2,
  });
  row.addComponent(Button).transition = Button.Transition.NONE;
  bindPressEffect(row);
  row.on(Button.EventType.CLICK, (): void => {
    Track.track('earn_guide_click', { kind, tab: route.tab });
    dismiss();
    jump?.(route.tab);
  });
  return row;
}

function paint(graphics: Graphics, width: number): void {
  graphics.fillColor = tint('#F6E2AE');
  graphics.roundRect(-width / 2, -GUIDE_H / 2, width, GUIDE_H, GUIDE_H / 2);
  graphics.fill();
  graphics.lineWidth = 2;
  graphics.strokeColor = tint(HEX.gold, 200);
  graphics.roundRect(-width / 2, -GUIDE_H / 2, width, GUIDE_H, GUIDE_H / 2);
  graphics.stroke();
  graphics.lineWidth = 1;
  graphics.strokeColor = COLORS.paper;
  graphics.roundRect(-width / 2 + 4, -GUIDE_H / 2 + 4, width - 8, GUIDE_H - 8, GUIDE_H / 2 - 4);
  graphics.stroke();
}
