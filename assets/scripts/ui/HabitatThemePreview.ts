// STATUS: implemented, W31 装修 B3/B4：双联预览（大厅 + 小屋同主题并排），差额态置灰但保留动作名与去后院出路
import { BlockInputEvents, Node } from 'cc';
import { Save } from '../cache/Save';
import { COPY, fillCopy } from '../config/CopyText';
import {
  buyHabitatTheme,
  HabitatTheme,
  isThemeOwned,
  selectHabitatTheme,
  ThemeOutcome,
  themeShortfall,
} from '../game/HabitatThemes';
import { ChoicePanel } from './ChoicePanel';
import { addEarnGuide } from './EarnGuide';
import { paintMiniLobby, paintMiniRoom } from './HabitatThemePreviewArt';
import { addCard } from './PanelKit';
import { addLabel, addRect } from './SceneUI';
import { screenHeight, screenWidth } from './ScreenMetrics';
import { COLORS, tint } from './Tokens';
import { addUIButton, setUIButtonState } from './UIButton';

export interface ThemePreviewContext {
  toastHost: Node;
  /** 成功购买 / 切换后交给面板收尾（关弹窗 + 重建小屋 + 刷新大厅）。 */
  finish: (outcome: ThemeOutcome) => void;
  /** 差额态的「去后院赚金币」要连小屋遮罩一起摘掉；从坞里直接开时至少关掉弹窗。 */
  onJump: () => void;
}

/** 预览层挂在装修弹窗遮罩上：关弹窗时一起销毁，不留第二套生命周期。 */
export function openThemePreview(host: Node, theme: HabitatTheme, ctx: ThemePreviewContext): Node {
  Save.load();
  const layer = addRect(host, 'ThemePreview', 0, screenWidth(), screenHeight(), tint(theme.panel));
  layer.addComponent(BlockInputEvents);
  layer.setSiblingIndex(host.children.length - 1);
  const top = screenHeight() / 2;
  addUIButton(layer, 'ThemePreviewBack', '‹ 返回', () => layer.destroy(), {
    y: top - 90,
    x: -244,
    width: 140,
    height: 56,
    color: COLORS.sub,
    fontSize: 22,
  });
  addLabel(layer, 'ThemePreviewName', theme.name, top - 90, { size: 34 });
  addLabel(layer, 'ThemePreviewTag', COPY.habitatThemePreviewing, top - 90, {
    size: 18,
    color: COLORS.sage,
    x: 236,
    width: 130,
  });
  const lobbyCard = addCard(layer, 'MiniLobbyCard', top - 350, 300, 320, {
    x: -164,
    color: tint(theme.card),
    shadow: false,
  });
  const roomCard = addCard(layer, 'MiniRoomCard', top - 350, 300, 320, {
    x: 164,
    color: tint(theme.card),
    shadow: false,
  });
  paintMiniLobby(lobbyCard, theme, 272, 292);
  paintMiniRoom(roomCard, theme, 272, 292);
  addMiniCaption(layer, '大厅', -164, top - 540);
  addMiniCaption(layer, '小屋', 164, top - 540);
  addLabel(layer, 'ThemePreviewInfo', theme.name, 40, { size: 24 });
  addLabel(layer, 'ThemePreviewDesc', COPY.habitatThemePreviewDesc, -4, {
    size: 16,
    color: COLORS.sub,
    width: 600,
  });
  addLabel(layer, 'ThemePreviewLegend', COPY.habitatThemeLegend, -52, { size: 15, color: COLORS.sub, width: 620 });
  buildFooter(layer, theme, ctx);
  return layer;
}

/** 底部价格区：价格 / 当前金币 / 差额三行 + 主按钮 + 差额指引，B3 与 B4 是同一块地方的不同状态。 */
function buildFooter(layer: Node, theme: HabitatTheme, ctx: ThemePreviewContext): void {
  const owned = isThemeOwned(theme);
  const lack = themeShortfall(theme);
  const footer = addCard(layer, 'ThemePreviewFooter', -300, 640, 330, { color: COLORS.paper });
  addLabel(footer, 'ThemePreviewPrice', fillCopy(COPY.habitatThemePriceLine, { cost: theme.cost }), 106, {
    size: 20,
    color: COLORS.sub,
    width: 560,
  });
  addLabel(footer, 'ThemePreviewWallet', fillCopy(COPY.habitatThemeWalletLine, { coins: Save.coins }), 68, {
    size: 20,
    color: COLORS.sub,
    width: 560,
  });
  if (lack > 0) {
    addLabel(footer, 'ThemePreviewLack', fillCopy(COPY.habitatThemeLackLine, { cost: lack }), 28, {
      size: 22,
      color: COLORS.danger,
      width: 560,
    });
  } else {
    addLabel(footer, 'ThemePreviewOk', COPY.habitatThemeOkLine, 28, { size: 20, color: COLORS.sage, width: 560 });
  }
  const label = owned ? COPY.habitatThemeUse : COPY.habitatThemeBuyNow;
  const shortLabel = fillCopy(COPY.habitatThemeBuyShort, { cost: lack });
  const button = addUIButton(footer, 'ThemeBuy', lack > 0 && !owned ? shortLabel : label, () => {
    if (owned) {
      ctx.finish(selectHabitatTheme(theme.id));
      return;
    }
    // 差额态只靠外观禁用挡不住非触摸派发，这里再拦一道
    if (themeShortfall(theme) > 0) {
      return;
    }
    confirm(theme, ctx);
  }, {
    y: -60,
    width: 440,
    height: 64,
    color: owned ? COLORS.sage : COLORS.gold,
    fontSize: 24,
  });
  if (lack > 0 && !owned) {
    setUIButtonState(button, false, shortLabel);
    addEarnGuide(footer, -136, 'coins', ctx.onJump, 'ThemeBuyGuide', 560);
  } else {
    addLabel(footer, 'ThemePreviewNote', COPY.habitatThemeFooterNote, -136, {
      size: 15,
      color: COLORS.sub,
      width: 560,
    });
  }
}

function addMiniCaption(layer: Node, text: string, x: number, y: number): void {
  addLabel(layer, `MiniCaption_${text}`, text, y, { size: 16, color: COLORS.sub, x, width: 200 });
}

/** 320–640 金币不是小数目，先确认再扣；金额由买主题那条路径统一校验。 */
function confirm(theme: HabitatTheme, ctx: ThemePreviewContext): void {
  const panel = new ChoicePanel();
  panel.open(ctx.toastHost, fillCopy(COPY.habitatThemeConfirm, { name: theme.name }), [
    {
      text: fillCopy(COPY.habitatThemeConfirmYes, { cost: theme.cost }),
      action: () => {
        panel.close();
        ctx.finish(buyHabitatTheme(theme.id));
      },
    },
    { text: COPY.habitatThemeConfirmNo, action: () => panel.close() },
  ]);
}
