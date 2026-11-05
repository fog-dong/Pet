// STATUS: implemented, W26 P2-E 大厅底部栈装配：TAB 栏 + 内容坞 + 合规链一次挂齐，切换与刷新都走同一个手柄
import type { Button, Node } from 'cc';
import { buildLobbyLinks, raiseToTop } from './LobbyChrome';
import { mountLobbyDock } from './LobbyDock';
import type { DockHost } from './DockKit';
import { lobbyToastY } from './LobbyDockLayout';
import { buildLobbyTabs } from './LobbyTabs';
import type { LobbyTab, TabBarHandle } from './LobbyTabs';
import { showToast } from './Toast';

/** 装配底部栈只需要这四样：宿主节点、场景里的 Start 按钮、菜单分派与「数据变了」回调。 */
export interface LobbyBottomSources {
  host: Node;
  startButton: Button | null;
  menu(name: string, focusPetId?: string): void;
  changed(): void;
}

export interface LobbyBottomHandle {
  show(tab: LobbyTab): void;
  refresh(): void;
  /** 合规链必须永远压在最上层：大厅后挂的成就角标与常驻提示会把它埋到下层，装配完成后要再提一次。 */
  raiseLinks(): void;
}

export function mountLobbyBottom(parent: Node, src: LobbyBottomSources): LobbyBottomHandle {
  const host: DockHost = {
    host: src.host,
    startButton: src.startButton,
    menu: src.menu,
    toast: (text) => showToast(src.host, text, { y: lobbyToastY() }),
    changed: src.changed,
  };
  // TAB 栏的回调要同时点亮自己并换坞：栏还在构造中，只能给它一个稍后回填的引用位。
  const dock = mountLobbyDock(parent, host);
  let tabs: TabBarHandle | null = null;
  const applyTab = (tab: LobbyTab): void => {
    tabs?.setActive(tab);
    dock.show(tab);
  };
  tabs = buildLobbyTabs(parent, applyTab);
  const links = buildLobbyLinks(parent, (name) => src.menu(name));
  return {
    show: applyTab,
    refresh: () => dock.refresh(),
    raiseLinks: () => raiseToTop(links),
  };
}
