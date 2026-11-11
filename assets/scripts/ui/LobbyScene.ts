// STATUS: implemented, W26 P2-E 大厅场景层：层序「底板→房间装饰→绿植→医生→封面宠→前台桌→散步带→HUD」
import type { Node } from 'cc';
import { GAME_NAME } from '../config/LegalConfig';
import { addDecor, addLogo, mountBackdrop } from './Backdrop';
import { HudHandle, mountHud } from './LobbyChrome';
import { CoverPetHandle, mountCoverPet } from './LobbyCoverPet';
import { lobbyDeskY, lobbyDeskW, lobbyPlantY } from './LobbyDockLayout';
import { lobbyLogoW, lobbyLogoY, lobbyTitleY } from './LobbyLayout';
import { mountLobbyPetRow, PetBandHandle } from './LobbyPetRow';
import { mountLobbyRoom } from './LobbyRoom';
import { mountBgmToggle } from './LobbySound';
import { addLabel, createNode } from './SceneUI';

const PLANT_W = 170;
const PLANT_X = 272;

export interface LobbySceneHandle {
  doctorSlot: Node;
  hud: HudHandle;
  band: PetBandHandle;
  cover: CoverPetHandle;
}

/**
 * 七层顺序：底板 → 房间装饰（窗/钟/光柱）→ 绿植 → 医生层位 → 封面宠 → 前台桌（挡住后两者下半身）→ 散步带 → 标题/HUD。
 * 医生立绘异步加载，所以层位必须在这里先占好；散步带在桌前，才读得出 2.5D 的前后关系。
 * 场景里的 Start 按钮不在这里排版：它由内容坞收养进「诊疗」TAB（见 DockClinic）。
 */
export function mountLobbyScene(parent: Node, onPickPet: (petId: string) => void): LobbySceneHandle {
  const backdrop = mountBackdrop(parent, 'lobby');
  mountLobbyRoom(backdrop);
  const plantY = lobbyPlantY();
  addDecor(backdrop, 'ui_plant', plantY, PLANT_W, -PLANT_X);
  addDecor(backdrop, 'ui_plant', plantY, PLANT_W, PLANT_X);
  addLogo(parent, lobbyLogoY(), lobbyLogoW());
  addLabel(parent, 'LobbyTitle', GAME_NAME, lobbyTitleY(), { size: 40 });
  const doctorSlot = createNode(parent, 'DoctorSlot', 0, 0, 0);
  const coverSlot = createNode(parent, 'LobbyCoverSlot', 0, 0, 0);
  addDecor(parent, 'ui_desk', lobbyDeskY(), lobbyDeskW());
  const cover = mountCoverPet(coverSlot, onPickPet);
  const band = mountLobbyPetRow(parent, onPickPet);
  const hud = mountHud(parent);
  mountBgmToggle(parent);
  return { doctorSlot, hud, band, cover };
}
