// STATUS: implemented, W25 P0-C 大厅场景层：纵向布局交给 LobbyLayout，层序「底板→绿植→医生→前台桌→散步带→HUD/按钮」
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
import { mountLobbyPetRow, PetBandHandle } from './LobbyPetRow';
import { addLabel, createNode } from './SceneUI';

const PLANT_W = 170;
const PLANT_X = 272;

export interface LobbySceneHandle {
  doctorSlot: Node;
  hud: HudHandle;
  band: PetBandHandle;
}

/**
 * 六层顺序：底板 → 绿植 → 医生层位 → 前台桌（挡住脚）→ 宠物散步带（压在柜面前板上）→ 标题/HUD/主按钮。
 * 医生立绘异步加载，所以层位必须在这里先占好；散步带在桌前，才读得出 2.5D 的前后关系。
 */
export function mountLobbyScene(
  parent: Node,
  startButton: Button | null,
  onPickPet: (petId: string) => void,
): LobbySceneHandle {
  const backdrop = mountBackdrop(parent, 'lobby');
  const plantY = lobbyPlantY();
  addDecor(backdrop, 'ui_plant', plantY, PLANT_W, -PLANT_X);
  addDecor(backdrop, 'ui_plant', plantY, PLANT_W, PLANT_X);
  addLogo(parent, lobbyLogoY(), lobbyLogoW());
  addLabel(parent, 'LobbyTitle', GAME_NAME, lobbyTitleY(), { size: 40 });
  const doctorSlot = createNode(parent, 'DoctorSlot', 0, 0, 0);
  addDecor(parent, 'ui_desk', lobbyDeskY(), lobbyDeskW());
  const band = mountLobbyPetRow(parent, onPickPet);
  const hud = mountHud(parent);
  if (startButton) {
    styleStartButton(startButton, COPY.lobbyStart);
    // 场景里的 Start 先于动态节点创建，提到最上层才不会被底板与前台桌盖住。
    startButton.node.setSiblingIndex(parent.children.length - 1);
  }
  return { doctorSlot, hud, band };
}
