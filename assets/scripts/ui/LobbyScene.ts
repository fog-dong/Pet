// STATUS: implemented, W16 P1 大厅场景层（墙/地/绿植/前台桌/医生层位/资源 HUD/主按钮样式）
import type { Button, Node } from 'cc';
import { COPY } from '../config/CopyText';
import { GAME_NAME } from '../config/LegalConfig';
import { addDecor, addLogo, floorLineY, mountBackdrop } from './Backdrop';
import { HudHandle, mountHud, styleStartButton } from './LobbyChrome';
import { addLabel, createNode } from './SceneUI';

// 纵向预算（720×1280）：胶囊 HUD 552..616，logo 300..534，主按钮 173..285，医生头顶 160。
const LOGO_W = 400;
const LOGO_Y = 417;
const TITLE_Y = 380;

export interface LobbySceneHandle {
  doctorSlot: Node;
  hud: HudHandle;
}

/**
 * 五层顺序：底板 → 绿植 → 医生层位 → 前台桌（挡住脚）→ 标题/HUD/主按钮。
 * 医生立绘异步加载，所以层位必须在这里先占好。
 */
export function mountLobbyScene(parent: Node, startButton: Button | null): LobbySceneHandle {
  const floor = floorLineY('lobby');
  const backdrop = mountBackdrop(parent, 'lobby');
  addDecor(backdrop, 'ui_plant', floor + 85, 170, -272);
  addDecor(backdrop, 'ui_plant', floor + 85, 170, 272);
  addLogo(parent, LOGO_Y, LOGO_W);
  addLabel(parent, 'LobbyTitle', GAME_NAME, TITLE_Y, { size: 40 });
  const doctorSlot = createNode(parent, 'DoctorSlot', 0, 10, 10);
  addDecor(parent, 'ui_desk', -250, 640);
  const hud = mountHud(parent);
  if (startButton) {
    styleStartButton(startButton, COPY.lobbyStart);
    // 场景里的 Start 先于动态节点创建，提到最上层才不会被底板与前台桌盖住。
    startButton.node.setSiblingIndex(parent.children.length - 1);
  }
  return { doctorSlot, hud };
}
