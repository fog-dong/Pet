// STATUS: implemented, W25 P1-C 小屋装修入口与弹窗（购买/切换后由外面重建小屋）
// W31：按设计稿 B2 改为 2×2 大卡网格 + 双联预览；卡面常驻差额，点卡先看不直接扣钱。
import { BlockInputEvents, Color, Node } from 'cc';
import { Save } from '../cache/Save';
import { COPY } from '../config/CopyText';
import { currentHabitatTheme, HABITAT_THEMES, isThemeOwned, ThemeOutcome } from '../game/HabitatThemes';
import { addLabel, addRect } from './SceneUI';
import { addCard } from './PanelKit';
import { fitWidth, screenHeight, screenWidth } from './ScreenMetrics';
import { buildThemeCard } from './HabitatThemeCard';
import { openThemePreview } from './HabitatThemePreview';
import { refreshLobbyBackdrop } from './Backdrop';
import { addEarnGuide } from './EarnGuide';
import { showToast } from './Toast';
import { COLORS } from './Tokens';
import { addUIButton } from './UIButton';

const PANEL_W = 660;
const PANEL_H = 680;
const GRID_X = 154;
/** 首排顶边 214，给 y=254 的指引条（高 48）留出 16px 空隙。 */
const ROW_Y = [104, -122];

let picker: Node | null = null;

export function closeThemePicker(): void {
  if (!picker) {
    return;
  }
  picker.destroy();
  picker = null;
}

/** 只要还有一档没买、且钱包不够，顶部就给指引条；全部买得起时留回原来的副标题。 */
function unaffordable(): boolean {
  return HABITAT_THEMES.some((theme) => !isThemeOwned(theme) && theme.cost > Save.coins);
}

/** 面板右上角入口：比底部三键更轻，不跟「领收益 / 关闭」抢主次。 */
export function addThemeEntry(panel: Node, panelWidth: number, onOpen: () => void): void {
  addUIButton(panel, 'HabitatThemeEntry', COPY.habitatThemeEntry, onOpen, {
    y: 350,
    x: panelWidth / 2 - 76,
    width: 112,
    height: 54,
    color: COLORS.sage,
    fontSize: 22,
  });
}

/**
 * host 是整块小屋遮罩：弹窗挂在它上面，切换主题时连它一起重建，
 * 因此本函数只负责关掉自己、把「已换好」的收尾交给调用方。
 * onJump 是「金币不足指引」点下去以前要清掉的整层：从坞里直接开弹窗时可以省略，
 * 从小屋面板里开必须传 closeHabitatPanel，否则遮罩还压着，跳过去也看不见。
 */
export function openThemePicker(
  host: Node,
  toastHost: Node,
  onApplied: () => void,
  onChanged?: () => void,
  onJump?: () => void,
): void {
  closeThemePicker();
  Save.load();
  const overlay = addRect(host, 'ThemeOverlay', 0, screenWidth(), screenHeight(), new Color(30, 22, 18, 140));
  overlay.addComponent(BlockInputEvents);
  overlay.setSiblingIndex(host.children.length - 1);
  picker = overlay;
  const width = fitWidth(PANEL_W, 30);
  const panel = addCard(overlay, 'ThemePanel', 0, width, PANEL_H, { color: COLORS.paper });
  addLabel(panel, 'ThemeTitle', COPY.habitatThemeTitle, 302, { size: 32 });
  addLabel(panel, 'ThemeCoins', `金币 ${Save.coins}`, 302, { size: 20, color: COLORS.sub, x: 208, width: 150 });
  if (unaffordable()) {
    // 买不起的时候这句副标题没有信息量，让位给「去哪弄金币」指引条（同一条 y=254 的横向位置）。
    addEarnGuide(panel, 254, 'coins', onJump ?? closeThemePicker, 'ThemeEarnGuide');
  } else {
    addLabel(panel, 'ThemeSubtitle', COPY.habitatThemeSubtitle, 254, {
      size: 18,
      color: COLORS.sub,
      width: width - 80,
    });
  }
  const finish = (outcome: ThemeOutcome): void => {
    if (outcome.kind !== 'done') {
      showToast(toastHost, outcome.text);
      return;
    }
    if (onChanged) {
      onChanged();
    }
    closeThemePicker();
    onApplied();
    refreshLobbyBackdrop();
    showToast(toastHost, outcome.text);
  };
  HABITAT_THEMES.forEach((theme, index) => {
    const x = index % 2 === 0 ? -GRID_X : GRID_X;
    const y = ROW_Y[Math.floor(index / 2)];
    buildThemeCard(panel, theme, x, y, (picked) => {
      if (currentHabitatTheme().id === picked.id) {
        showToast(toastHost, COPY.habitatThemeUsing);
        return;
      }
      openThemePreview(overlay, picked, { toastHost, finish, onJump: onJump ?? closeThemePicker });
    });
  });
  addLabel(panel, 'ThemeHint', COPY.habitatThemeHint, -252, {
    size: 14,
    color: COLORS.sub,
    width: width - 40,
  });
  addUIButton(panel, 'ThemeClose', '关 闭', closeThemePicker, {
    y: -298,
    width: 220,
    height: 64,
    color: COLORS.sub,
    fontSize: 24,
  });
}
