// STATUS: implemented, W26 P2-E 大厅底部栈：文字链 → TAB 栏 → 内容坞 → 散步带 → 前台桌 → 医生，全部按剩余高度派生
// 可视高度随屏幕比例变（FIXED_WIDTH 下平板只有 960 设计单位，刘海机能到 1558），底部一律从天花板反推，不写死绝对坐标。
import { lobbyCeilY, lobbyLinksH, lobbyLinksY } from './LobbyLayout';

/**
 * 立绘层级：贴图区占 size 的 0.86 且整体上移 0.04，doc_director 自身上下留 3.1%。
 * 因为贴图区不在正中，头顶与脚底到节点原点并不对称：头顶 +0.4433，脚底 -0.3633。
 */
const ART_HEAD_RATIO = 0.4433;
const ART_FOOT_RATIO = 0.3633;
const DESK_W = 700;
const DESK_ASPECT = 2;
/** ui_desk 768×384：台面后沿（医生落脚线）在整图 25.8% 处，桌位置由它反推，不再单独扣上下透明边。 */
const DESK_EDGE_FRAC = 0.258;

/** TAB 栏 92 高：720 帧下正好是 46 物理 px 的触控靶，满足 44 下限。 */
export const TAB_H = 92;
const TAB_GAP = 10;
const DOCK_GAP = 12;
/** 内容坞在「TAB 顶沿 → 天花板」里最多占的比例，剩下的留给散步带与医生。 */
const DOCK_SHARE = 0.45;
const DOCK_MIN = 180;
const DOCK_MAX = 300;
/** 散步带拿「天花板与桌沿之间」扣掉医生最低身高后的剩余，最低只到 120，再矮就不如不站。 */
const BAND_MIN = 120;
const BAND_MAX = 180;
/** 内容坞顶沿到散步带盒底的呼吸。 */
const SCENE_INSET = 6;
/** 台面后沿压在宠物头顶上方 22px：立绘整只落在柜面前板里，才读成「柜子前面的地板」。 */
const EDGE_OVER_BAND = 22;
/** 浮层提示落在内容坞上方：坞是新的底部主体，硬编码 -320 在平板比例会压到 TAB 栏。 */
const TOAST_OVER_DOCK = 34;
/** 绿植半株探出台面：锚在桌心上方，不随台沿线浮动。 */
const PLANT_OVER_DESK = 92;
/** 下限从 300 收到 160：平板比例下整段墙只剩 70 出头，留 300 会直接顶穿角标。 */
const DOCTOR_MIN = 160;
/** 上限 480：屏宽 1/3 的视觉预算给散步带的宠物，医生退成背景叙事。 */
const DOCTOR_MAX = 480;
/** 鞋尖压进台面后沿 8px，只留一条被柜面切掉的鞋底，才不会读成悬空。 */
const DOCTOR_SINK = 8;
/** 坞内三行等分：行高再扣掉呼吸，按槽位 0/1/2 取纵坐标。 */
const DOCK_ROWS = 3;
const DOCK_ROW_GAP = 8;

function clamp(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function boxHeight(width: number, aspect: number): number {
  return width / aspect;
}

export function lobbyTabBarY(): number {
  return lobbyLinksY() + lobbyLinksH() / 2 + TAB_GAP + TAB_H / 2;
}

export function dockHeight(): number {
  const available = lobbyCeilY() - (lobbyTabBarY() + TAB_H / 2);
  return clamp(DOCK_MIN, available * DOCK_SHARE, DOCK_MAX);
}

export function lobbyDockY(): number {
  return lobbyTabBarY() + TAB_H / 2 + DOCK_GAP + dockHeight() / 2;
}

/** 坞内三行的行心：内容坞高度跨 180–300，行位与行高只能按等分派生。 */
export function lobbyDockRow(slot: number): number {
  const step = dockHeight() / DOCK_ROWS;
  return (DOCK_ROWS / 2 - 0.5 - slot) * step;
}

export function lobbyDockRowH(): number {
  return dockHeight() / DOCK_ROWS - DOCK_ROW_GAP;
}

export function lobbyPetBandSize(): number {
  const floor = dockFloorY();
  const wall = lobbyCeilY() - floor;
  const room = wall - DOCTOR_MIN * (ART_HEAD_RATIO + ART_FOOT_RATIO) - EDGE_OVER_BAND - SCENE_INSET;
  return clamp(BAND_MIN, room, BAND_MAX);
}

export function lobbyPetBandY(): number {
  return dockFloorY() + SCENE_INSET + lobbyPetBandSize() / 2;
}

export function lobbyDeskW(): number {
  return DESK_W;
}

/** 台面后沿（医生落脚线，也是柜面前板的顶边）：由散步带顶沿往上让出一截，桌随宠物走。 */
export function lobbyDeskEdgeY(): number {
  return lobbyPetBandY() + lobbyPetBandSize() / 2 + EDGE_OVER_BAND;
}

export function lobbyDeskY(): number {
  const height = boxHeight(DESK_W, DESK_ASPECT);
  return lobbyDeskEdgeY() - height / 2 + DESK_EDGE_FRAC * height;
}

export function lobbyPlantY(): number {
  return lobbyDeskY() + PLANT_OVER_DESK;
}

/** 脚底沉进台面后沿 8px，中间这段墙能站多高的人就站多高，头顶永远不越过角标下沿。 */
export function lobbyDoctorSize(): number {
  const span = lobbyCeilY() - (lobbyDeskEdgeY() - DOCTOR_SINK);
  return clamp(DOCTOR_MIN, span / (ART_HEAD_RATIO + ART_FOOT_RATIO), DOCTOR_MAX);
}

export function lobbyDoctorY(): number {
  return lobbyDeskEdgeY() - DOCTOR_SINK + ART_FOOT_RATIO * lobbyDoctorSize();
}

/** 内容坞顶沿 + 呼吸：散步带、前台桌、医生这一整块场景带的地板线。 */
function dockFloorY(): number {
  return lobbyDockY() + dockHeight() / 2 + SCENE_INSET;
}

/** 浮层提示的落点：永远压在内容坞上方，不跟 TAB 栏抢位置。 */
export function lobbyToastY(): number {
  return lobbyDockY() + dockHeight() / 2 + TOAST_OVER_DOCK;
}
