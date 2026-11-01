// STATUS: implemented, W20-1 大厅场景层：纵向布局全部交给 LobbyLayout，顶部扣安全区、木桌贴底部安全区
import type { Button, Node } from 'cc';
import { COPY } from '../config/CopyText';
import { GAME_NAME } from '../config/LegalConfig';
import { addDecor, addLogo, mountBackdrop } from './Backdrop';
import { HudHandle, mountHud, styleStartButton } from './LobbyChrome';
import {
  lobbyDeskW,
  lobbyDeskY,
  lobbyLogoW,
  lobbyLogoY,
  lobbyPlantY,
  lobbyTitleY,
} from './LobbyLayout';
import { addLabel, createNode } from './SceneUI';

const PLANT_W = 170;
const PLANT_X = 272;

export interface LobbySceneHandle {
  doctorSlot: Node;
  hud: HudHandle;
}

/**
 * 五层顺序：底板 → 绿植 → 医生层位 → 前台桌（挡住脚）→ 标题/HUD/主按钮。
 * 医生立绘异步加载，所以层位必须在这里先占好。
 */
export function mountLobbyScene(parent: Node, startButton: Button | null): LobbySceneHandle {
  const backdrop = mountBackdrop(parent, 'lobby');
  const plantY = lobbyPlantY();
  addDecor(backdrop, 'ui_plant', plantY, PLANT_W, -PLANT_X);
  addDecor(backdrop, 'ui_plant', plantY, PLANT_W, PLANT_X);
  addLogo(parent, lobbyLogoY(), lobbyLogoW());
  addLabel(parent, 'LobbyTitle', GAME_NAME, lobbyTitleY(), { size: 40 });
  const doctorSlot = createNode(parent, 'DoctorSlot', 0, 0, 0);
  addDecor(parent, 'ui_desk', lobbyDeskY(), lobbyDeskW());
  const hud = mountHud(parent);
  if (startButton) {
    styleStartButton(startButton, COPY.lobbyStart);
    // 场景里的 Start 先于动态节点创建，提到最上层才不会被底板与前台桌盖住。
    startButton.node.setSiblingIndex(parent.children.length - 1);
  }
  return { doctorSlot, hud };
}
