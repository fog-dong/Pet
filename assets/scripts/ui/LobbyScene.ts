// STATUS: implemented, W26 P2-E 大厅场景层：层序「底板→绿植→医生→前台桌→散步带→HUD」，玩法入口与 TAB 交给 Lobby 装配
import type { Node } from 'cc';
import { GAME_NAME } from '../config/LegalConfig';
import { addDecor, addLogo, mountBackdrop } from './Backdrop';
import { HudHandle, mountHud } from './LobbyChrome';
import { lobbyDeskW, lobbyDeskY, lobbyPlantY } from './LobbyDockLayout';
import { lobbyLogoW, lobbyLogoY, lobbyTitleY } from './LobbyLayout';
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
 * 六层顺序：底板 → 绿植 → 医生层位 → 前台桌（挡住脚）→ 宠物散步带 → 标题/HUD。
 * 医生立绘异步加载，所以层位必须在这里先占好；散步带在桌前，才读得出 2.5D 的前后关系。
 * 场景里的 Start 按钮不在这里排版：它由内容坞收养进「诊疗」TAB（见 DockClinic）。
 */
export function mountLobbyScene(parent: Node, onPickPet: (petId: string) => void): LobbySceneHandle {
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
  return { doctorSlot, hud, band };
}
