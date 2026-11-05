// STATUS: implemented, W26 P2-E 大厅内容坞：TAB 栏上方的三行内容区，四块常驻、切 TAB 做 0.2s 交叉淡入 + 12px 上浮
// Cocos 不是 Web 工程，动效不走 CSS：时长与缓动一律取 Tokens.DURATION，低端机（Quality.low）直接落终态。
// 四块内容一次建好、只切 active：既保住场景 Start 等既有节点名，也省掉每次切换重建面板的开销。
import { Node, Tween, UIOpacity, Vec3, tween } from 'cc';
import { Quality } from '../config/Quality';
import { buildAchieveBody } from './DockAchieve';
import { buildClinicBody } from './DockClinic';
import { buildGardenBody } from './DockGarden';
import { buildHabitatBody } from './DockHabitat';
import type { DockBody, DockContext, DockHost } from './DockKit';
import { dockHeight, lobbyDockY } from './LobbyDockLayout';
import { addCard, createBox } from './PanelKit';
import { fitWidth } from './ScreenMetrics';
import { COLORS, DURATION } from './Tokens';
import { LOBBY_TABS, type LobbyTab } from './LobbyTabs';

const DOCK_W = 704;
const BODY_INSET_X = 30;
const BODY_INSET_Y = 16;
const DEFAULT_TAB: LobbyTab = 'clinic';
const RISE = 12;

const BUILDERS: Record<LobbyTab, (parent: Node, ctx: DockContext) => DockBody> = {
  clinic: buildClinicBody,
  garden: buildGardenBody,
  habitat: buildHabitatBody,
  achieve: buildAchieveBody,
};

export interface LobbyDockHandle {
  show(tab: LobbyTab): void;
  refresh(): void;
}

export function mountLobbyDock(parent: Node, host: DockHost): LobbyDockHandle {
  const width = fitWidth(DOCK_W, 8);
  const card = addCard(parent, 'LobbyDock', lobbyDockY(), width, dockHeight(), {
    radius: 26,
    color: COLORS.paper,
  });
  const ctx: DockContext = { ...host, width: width - BODY_INSET_X * 2 };
  const inner = ctx.width;
  const bodies = LOBBY_TABS.reduce((acc, [tab]) => {
    const box = createBox(card, `Dock_${tab}`, 0, inner, dockHeight() - BODY_INSET_Y * 2);
    box.active = tab === DEFAULT_TAB;
    acc[tab] = BUILDERS[tab](box, ctx);
    return acc;
  }, {} as Record<LobbyTab, DockBody>);
  let current = DEFAULT_TAB;
  bodies[current].refresh();

  return {
    show(tab: LobbyTab): void {
      if (tab === current) {
        return;
      }
      const from = bodies[current].node;
      const to = bodies[tab].node;
      current = tab;
      bodies[tab].refresh();
      swap(from, to);
    },
    /** 领取 / 互动之后只刷当前这块：隐藏的三块在 show 时各自补一次，不必跟着全表重算。 */
    refresh(): void {
      bodies[current].refresh();
    },
  };
}

/** 旧的淡出后收起，新的边浮边显：两段同时长，读起来是一次换页而不是两次动作。 */
function swap(from: Node, to: Node): void {
  if (Quality.low) {
    from.active = false;
    to.active = true;
    settle(to);
    return;
  }
  fade(from, 0, () => {
    from.active = false;
  });
  to.active = true;
  Tween.stopAllByTarget(to);
  settle(to);
  opacityOf(to).opacity = 0;
  to.setPosition(0, -RISE, 0);
  tween(to)
    .to(DURATION.tabSwap, { position: new Vec3(0, 0, 0) }, { easing: 'quadOut' })
    .start();
  fade(to, 255);
}

function fade(node: Node, target: number, onEnd?: () => void): void {
  const opacity = opacityOf(node);
  Tween.stopAllByTarget(opacity);
  tween(opacity)
    .to(DURATION.tabSwap, { opacity: target }, { easing: 'quadOut' })
    .call(() => {
      if (onEnd) {
        onEnd();
      }
    })
    .start();
}

/** 归位：上一段浮入没播完就被再次切走时，位置与透明度先落到终值再重新起幅。 */
function settle(node: Node): void {
  node.setPosition(0, 0, 0);
  opacityOf(node).opacity = 255;
}

function opacityOf(node: Node): UIOpacity {
  return node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
}
