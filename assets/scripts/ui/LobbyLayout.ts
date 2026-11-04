// STATUS: implemented, W25 P0-C 大厅纵向布局：顶部资源/标题/提示，底部自下而上排文字链→入口行→主按钮→宠物散步带，前台桌与医生由散步带顶沿反推
// 素材整图都有透明边，占位盒与可见内容不同尺寸；inset / 剖面由 scripts/png-codec 实测 alpha 包围盒得出。
import { safeAreaBottom, safeAreaTop, screenHeight } from './ScreenMetrics';

/** ui_logo 364×212：四边各留 3.2% 透明。 */
const LOGO_INSET = 0.032;
/** ui_desk 768×384：台面后沿（医生落脚线）在整图 25.8% 处，桌位置由它反推，不再单独扣上下透明边。 */
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
const HUD_MARGIN = 32;
const HUD_H = 56;
const BUTTON_H = 112;
const ENTRY_H = 78;
const LINKS_H = 22;
const HINT_H = 24;
const BADGE_H = 56;
/** 底部栈：贴安全区下沿起往上排，每段呼吸只在这几个常数里改。 */
const LINKS_MARGIN = 18;
const LINKS_GAP = 12;
const ENTRY_GAP = 18;
/** 散步带盒底离按钮 51：垫子中心在带心下方 92、高 146，下沿比带盒还低 45，剩下 6 才是看得见的呼吸。 */
const BUTTON_GAP = 51;
/** 台面后沿压在宠物头顶上方 22px：立绘整只落在柜面前板里，才读成「柜子前面的地板」。 */
const EDGE_OVER_BAND = 22;
/** 木牌是悬挂式，牌面视觉中心比整图中心低 37，标题文字跟着牌面走。 */
const TITLE_DROP = 37;
const LOGO_GAP = 12;
const HINT_GAP = 8;
const HEAD_GAP = 14;
/** 绿植半株探出台面：锚在桌心上方，不随台沿线浮动。 */
const PLANT_OVER_DESK = 92;
const DOCTOR_MIN = 300;
/** 上限从 620 收到 480：屏宽 1/3 的视觉预算给散步带的宠物，医生退成背景叙事。 */
const DOCTOR_MAX = 480;
/** 鞋尖压进台面后沿 8px，只留一条被柜面切掉的鞋底，才不会读成悬空。 */
const DOCTOR_SINK = 8;

export const PET_BAND_SIZE = 240;

function topEdge(): number {
  return screenHeight() / 2 - safeAreaTop();
}

function bottomEdge(): number {
  return -screenHeight() / 2 + safeAreaBottom();
}

function boxHeight(width: number, aspect: number): number {
  return width / aspect;
}

/** 资源胶囊贴安全区上沿：刘海机上再往下压 32，与 BackButton 同一套逐元素扣 inset 的口径。 */
export function lobbyHudTop(): number {
  return HUD_MARGIN + safeAreaTop();
}

/** 胶囊与主按钮共用同一个左边距，不再各写一个 24 / 32。 */
export function lobbyHudLeft(): number {
  return HUD_MARGIN;
}

export function lobbyLogoW(): number {
  return LOGO_W;
}

export function lobbyLogoY(): number {
  const height = boxHeight(LOGO_W, LOGO_ASPECT);
  const visibleTop = topEdge() - HUD_MARGIN - HUD_H - 8;
  return visibleTop - height / 2 + LOGO_INSET * height;
}

export function lobbyTitleY(): number {
  return lobbyLogoY() - TITLE_DROP;
}

function logoVisibleBottom(): number {
  const height = boxHeight(LOGO_W, LOGO_ASPECT);
  return lobbyLogoY() - height / 2 + LOGO_INSET * height;
}

/** 常驻提示与同步角标从牌面下沿往下排，医生头顶上限由它们一起让出。 */
export function lobbyHintY(): number {
  return logoVisibleBottom() - LOGO_GAP - HINT_H / 2;
}

export function lobbyBadgeY(): number {
  return lobbyHintY() - HINT_H / 2 - HINT_GAP - BADGE_H / 2;
}

export function lobbyLinksY(): number {
  return bottomEdge() + LINKS_MARGIN + LINKS_H / 2;
}

export function lobbyEntryRowY(): number {
  return lobbyLinksY() + LINKS_H / 2 + LINKS_GAP + ENTRY_H / 2;
}

/** 主按钮从 logo 下方挪到散步带之下：底部这一块是「操作区」，散步带是「主角区」，两层不抢。 */
export function lobbyStartY(): number {
  return lobbyEntryRowY() + ENTRY_H / 2 + ENTRY_GAP + BUTTON_H / 2;
}

export function lobbyPetBandY(): number {
  return lobbyStartY() + BUTTON_H / 2 + BUTTON_GAP + PET_BAND_SIZE / 2;
}

export function lobbyDeskW(): number {
  return DESK_W;
}

/** 台面后沿（医生落脚线，也是柜面前板的顶边）：由散步带顶沿往上让出一截，桌随宠物走。 */
export function lobbyDeskEdgeY(): number {
  return lobbyPetBandY() + PET_BAND_SIZE / 2 + EDGE_OVER_BAND;
}

export function lobbyDeskY(): number {
  const height = boxHeight(DESK_W, DESK_ASPECT);
  return lobbyDeskEdgeY() - height / 2 + DESK_EDGE_FRAC * height;
}

export function lobbyPlantY(): number {
  return lobbyDeskY() + PLANT_OVER_DESK;
}

/** 角标下沿留 14 呼吸，脚底沉进台面后沿 8px，中间这段墙能站多高的人就站多高。 */
export function lobbyDoctorSize(): number {
  const headTop = lobbyBadgeY() - BADGE_H / 2 - HEAD_GAP;
  const span = headTop - lobbyDoctorFeetY();
  return Math.max(DOCTOR_MIN, Math.min(DOCTOR_MAX, span / (ART_HEAD_RATIO + ART_FOOT_RATIO)));
}

export function lobbyDoctorY(): number {
  return lobbyDoctorFeetY() + ART_FOOT_RATIO * lobbyDoctorSize();
}

function lobbyDoctorFeetY(): number {
  return lobbyDeskEdgeY() - DOCTOR_SINK;
}
