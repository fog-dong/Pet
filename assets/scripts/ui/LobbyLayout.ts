// STATUS: implemented, W20-1 大厅纵向布局：顶部块贴安全区上沿、木桌块贴安全区下沿，医生立绘由桌沿反推
// 素材整图都有透明边，占位盒与可见内容不同尺寸；inset / 剖面由 scripts/png-codec 实测 alpha 包围盒得出。
import { safeAreaBottom, safeAreaTop, screenHeight } from './ScreenMetrics';

/** ui_logo 364×212：四边各留 3.2% 透明。 */
const LOGO_INSET = 0.032;
/** ui_desk 768×384：上下 4.2% 透明；台面后沿（医生落脚线）在整图 25.8% 处。 */
const DESK_INSET = 0.042;
const DESK_EDGE_FRAC = 0.258;
/**
 * 立绘层级：贴图区占 size 的 0.86 且整体上移 0.04，doc_director 自身上下留 3.1%。
 * 因为贴图区不在正中，头顶与脚底到节点原点并不对称：头顶 +0.4433，脚底 -0.3633。
 */
const ART_HEAD_RATIO = 0.4433;
const ART_FOOT_RATIO = 0.3633;

const LOGO_W = 364;
const LOGO_ASPECT = 1.716;
const DESK_W = 700;
const DESK_ASPECT = 2;
const HUD_MARGIN = 40;
const HUD_H = 56;
const BUTTON_H = 112;
const DESK_BOTTOM_MARGIN = 150;
/** 绿植半株探出台面：锚在桌心上方，不随台沿线浮动。 */
const PLANT_OVER_DESK = 92;
const MENU_ROW1_OVER_EDGE = 85;
const MENU_ROW_PITCH = 92;
const HEAD_GAP = 24;
const DOCTOR_MIN = 320;
/** 上限只兜异形屏：16:9 机型上公式自己算出 549，用不到这个天花板。 */
const DOCTOR_MAX = 620;
/** 鞋尖压进台面后沿 8px，只留一条被柜面切掉的鞋底，才不会读成悬空。 */
const DOCTOR_SINK = 8;

function topEdge(): number {
  return screenHeight() / 2 - safeAreaTop();
}

function bottomEdge(): number {
  return -screenHeight() / 2 + safeAreaBottom();
}

function boxHeight(width: number, aspect: number): number {
  return width / aspect;
}

/** 资源胶囊贴安全区上沿：刘海机上再往下压 40，与 BackButton 同一套逐元素扣 inset 的口径。 */
export function lobbyHudTop(): number {
  return HUD_MARGIN + safeAreaTop();
}

export function lobbyLogoW(): number {
  return LOGO_W;
}

export function lobbyLogoY(): number {
  const height = boxHeight(LOGO_W, LOGO_ASPECT);
  const visibleTop = topEdge() - HUD_MARGIN - HUD_H - 8;
  return visibleTop - height / 2 + LOGO_INSET * height;
}

/** 木牌是悬挂式，牌面视觉中心比整图中心低 37，标题文字跟着牌面走。 */
export function lobbyTitleY(): number {
  return lobbyLogoY() - 37;
}

export function lobbyStartY(): number {
  const height = boxHeight(LOGO_W, LOGO_ASPECT);
  const logoVisibleBottom = lobbyLogoY() - height / 2 + LOGO_INSET * height;
  return logoVisibleBottom - 12 - BUTTON_H / 2;
}

export function lobbyDeskW(): number {
  return DESK_W;
}

export function lobbyDeskY(): number {
  const height = boxHeight(DESK_W, DESK_ASPECT);
  return bottomEdge() + DESK_BOTTOM_MARGIN + height / 2 - DESK_INSET * height;
}

/** 台面后沿（医生落脚线，也是柜面前板的顶边）：菜单两行与立绘都从这条线反推。 */
export function lobbyDeskEdgeY(): number {
  const height = boxHeight(DESK_W, DESK_ASPECT);
  return lobbyDeskY() + height / 2 - DESK_EDGE_FRAC * height;
}

export function lobbyPlantY(): number {
  return lobbyDeskY() + PLANT_OVER_DESK;
}

export function lobbyMenuRow(index: number): number {
  return lobbyDeskEdgeY() - MENU_ROW1_OVER_EDGE - index * MENU_ROW_PITCH;
}

/** 主按钮下沿留 24 呼吸，脚底沉进台面后沿 8px，中间这段墙能站多高的人就站多高。 */
export function lobbyDoctorSize(): number {
  const headTop = lobbyStartY() - BUTTON_H / 2 - HEAD_GAP;
  const span = headTop - lobbyDoctorFeetY();
  return Math.max(DOCTOR_MIN, Math.min(DOCTOR_MAX, span / (ART_HEAD_RATIO + ART_FOOT_RATIO)));
}

export function lobbyDoctorY(): number {
  return lobbyDoctorFeetY() + ART_FOOT_RATIO * lobbyDoctorSize();
}

function lobbyDoctorFeetY(): number {
  return lobbyDeskEdgeY() - DOCTOR_SINK;
}

export function lobbyHintY(): number {
  return bottomEdge() + DESK_BOTTOM_MARGIN - 34;
}

export function lobbyBadgeY(): number {
  return lobbyHintY() - 46;
}
