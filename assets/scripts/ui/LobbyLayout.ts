// STATUS: implemented, W26 P2-E 大厅顶部栈与底部锚点：资源/标题/提示/称号自上而下，合规文字链贴安全区下沿
// 底部 TAB 栏、内容坞、散步带、前台桌与医生的纵向几何派生自本文件的 lobbyLinksY / lobbyBadgeY，见 ui/LobbyDockLayout.ts。
// 素材整图都有透明边，占位盒与可见内容不同尺寸；inset / 剖面由 scripts/png-codec 实测 alpha 包围盒得出。
import { safeAreaBottom, safeAreaTop, screenHeight } from './ScreenMetrics';

/** ui_logo 364×212：四边各留 3.2% 透明。 */
const LOGO_INSET = 0.032;
const LOGO_W = 364;
const LOGO_ASPECT = 1.716;
const HUD_MARGIN = 32;
const HUD_H = 56;
const HUD_ROW_GAP = 8;
/** 称号胶囊宽度：第二行与音乐开关并排，两个模块共用这一个宽度口径。 */
export const TITLE_PILL_W = 256;
const LINKS_H = 22;
const HINT_H = 24;
const BADGE_H = 56;
const LINKS_MARGIN = 18;
/** 木牌是悬挂式：ui_logo 里牌面（绿框内沿）中心在整图中心下方 48，标题文字跟牌面走。 */
const TITLE_DROP = 48;
const LOGO_GAP = 12;
const HINT_GAP = 8;
/** 角标下沿再让出的呼吸；底部所有内容区的天花板由它决定。 */
const HEAD_GAP = 14;
/** 微信胶囊与游戏圈常驻右上角（约占屏宽右侧 40%），够高时把称号与音乐整体挪到左上第二行。 */
const TWO_ROW_MIN_H = 1200;

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

/** 微信胶囊与游戏圈压住右上角：手机取 2 行把称号与音乐挪到左侧，平板高度不够就退回 1 行。 */
export function lobbyHudRows(): number {
  return screenHeight() >= TWO_ROW_MIN_H ? 2 : 1;
}

/** 第二行顶边：与 lobbyHudTop 同一套 Widget 锚点语义，称号与音乐都钉在这里。 */
export function lobbyHudSecondTop(): number {
  return lobbyHudTop() + HUD_H + HUD_ROW_GAP;
}

export function lobbyLogoY(): number {
  const height = boxHeight(LOGO_W, LOGO_ASPECT);
  const rows = lobbyHudRows();
  const stack = HUD_H * rows + HUD_ROW_GAP * (rows - 1);
  const visibleTop = topEdge() - HUD_MARGIN - stack - 8;
  return visibleTop - height / 2 + LOGO_INSET * height;
}

export function lobbyTitleY(): number {
  return lobbyLogoY() - TITLE_DROP;
}

function logoVisibleBottom(): number {
  const height = boxHeight(LOGO_W, LOGO_ASPECT);
  return lobbyLogoY() - height / 2 + LOGO_INSET * height;
}

/** 常驻提示与同步角标从牌面下沿往下排，内容区的天花板由它们一起让出。 */
export function lobbyHintY(): number {
  return logoVisibleBottom() - LOGO_GAP - HINT_H / 2;
}

export function lobbyBadgeY(): number {
  return lobbyHintY() - HINT_H / 2 - HINT_GAP - BADGE_H / 2;
}

/** 合规文字链是唯一贴底的东西：TAB 栏永远排在它上方，任何内容层都不许盖过这条线。 */
export function lobbyLinksY(): number {
  return bottomEdge() + LINKS_MARGIN + LINKS_H / 2;
}

export function lobbyLinksH(): number {
  return LINKS_H;
}

/** 角标下沿再让 14：TAB 内容坞与前台场景带共用的天花板，医生头顶不许越过这条线。 */
export function lobbyCeilY(): number {
  return lobbyBadgeY() - BADGE_H / 2 - HEAD_GAP;
}
