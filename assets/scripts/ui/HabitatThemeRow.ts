// STATUS: implemented, W25 P1-C 装修弹窗的单行（缩略图 + 名称 + 状态按钮 + 购买二次确认）；W28 P1-3 买不起直接禁用
import { Label, Node } from 'cc';
import { COPY, fillCopy } from '../config/CopyText';
import {
  buyHabitatTheme,
  currentHabitatTheme,
  HabitatTheme,
  isThemeOwned,
  selectHabitatTheme,
  ThemeOutcome,
  themeShortfall,
} from '../game/HabitatThemes';
import { ChoicePanel } from './ChoicePanel';
import { addLabel } from './SceneUI';
import { addCard } from './PanelKit';
import { paintThemePreview } from './HabitatThemeArt';
import { COLORS } from './Tokens';
import { addUIButton, setUIButtonState } from './UIButton';

export const ROW_W = 580;
export const ROW_H = 118;

export function buildThemeRow(
  panel: Node,
  theme: HabitatTheme,
  y: number,
  host: Node,
  finish: (outcome: ThemeOutcome) => void,
): void {
  const row = addCard(panel, `ThemeRow_${theme.id}`, y, ROW_W, ROW_H, { color: COLORS.paper, shadow: false });
  paintThemePreview(row, theme, -200, 0, 140, 92);
  addLabel(row, `ThemeName_${theme.id}`, theme.name, 24, {
    size: 26,
    x: -40,
    width: 210,
    align: Label.HorizontalAlign.LEFT,
  });
  addLabel(row, `ThemeBlurb_${theme.id}`, theme.blurb, -16, {
    size: 17,
    color: COLORS.sub,
    x: -40,
    width: 224,
    align: Label.HorizontalAlign.LEFT,
  });
  const current = currentHabitatTheme().id === theme.id;
  const owned = isThemeOwned(theme);
  // W28 P1-3：买不起的行当场按禁用态渲染，按钮写「差 N 金币」，不再让玩家点完确认弹窗才发现钱不够。
  const lack = themeShortfall(theme);
  const button = addUIButton(row, `ThemePick_${theme.id}`, pickText(theme, current, owned, lack), () => {
    if (currentHabitatTheme().id === theme.id) {
      return;
    }
    if (owned) {
      finish(selectHabitatTheme(theme.id));
      return;
    }
    // W28 P1-3：禁用态只是外观，这里再拦一道，任何派发路径都不会把「钱不够」推到确认弹窗后面。
    if (themeShortfall(theme) > 0) {
      return;
    }
    confirmBuy(host, theme, finish);
  }, {
    y: 0,
    x: 190,
    width: 150,
    height: 56,
    color: owned ? COLORS.sage : COLORS.gold,
    fontSize: 20,
  });
  if (current || lack > 0) {
    setUIButtonState(button, false, pickText(theme, current, owned, lack), owned ? COLORS.sage : COLORS.gold);
  }
}

function pickText(theme: HabitatTheme, current: boolean, owned: boolean, lack: number): string {
  if (current) {
    return COPY.habitatThemeUsing;
  }
  if (lack > 0) {
    return fillCopy(COPY.habitatThemeShort, { cost: lack });
  }
  return owned ? COPY.habitatThemeUse : fillCopy(COPY.habitatThemeBuy, { cost: theme.cost });
}

/** 200 / 500 金币不是小数目，先给一次确认，避免误触直接扣款。 */
function confirmBuy(host: Node, theme: HabitatTheme, finish: (outcome: ThemeOutcome) => void): void {
  const confirm = new ChoicePanel();
  confirm.open(host, fillCopy(COPY.habitatThemeConfirm, { name: theme.name }), [
    {
      text: fillCopy(COPY.habitatThemeConfirmYes, { cost: theme.cost }),
      action: () => {
        confirm.close();
        finish(buyHabitatTheme(theme.id));
      },
    },
    { text: COPY.habitatThemeConfirmNo, action: () => confirm.close() },
  ]);
}
