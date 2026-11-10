// STATUS: implemented, W31 装修小店双列大卡（缩略图 = 该主题的真实房间；卡角常驻差额，买不起也不下架）
import { Button, Node } from 'cc';
import { COPY, fillCopy } from '../config/CopyText';
import { currentHabitatTheme, HabitatTheme, isThemeOwned, themeShortfall } from '../game/HabitatThemes';
import { addCard } from './PanelKit';
import { paintThemePreview } from './HabitatThemeArt';
import { addLabel } from './SceneUI';
import { COLORS } from './Tokens';
import { bindPressEffect } from './UIButton';

export const CARD_W = 290;
export const CARD_H = 220;

/** 一张主题卡：点整卡进双联预览；卡面只负责「现在是什么状态」。 */
export function buildThemeCard(
  panel: Node,
  theme: HabitatTheme,
  x: number,
  y: number,
  onPick: (theme: HabitatTheme) => void,
): void {
  const card = addCard(panel, `ThemePick_${theme.id}`, y, CARD_W, CARD_H, {
    x,
    color: COLORS.paper,
    shadow: false,
  });
  paintThemePreview(card, theme, 0, 48, 250, 106);
  addLabel(card, `ThemeName_${theme.id}`, theme.name, -20, { size: 24 });
  addLabel(card, `ThemeDesc_${theme.id}`, theme.blurb, -46, { size: 15, color: COLORS.sub, width: CARD_W - 24 });
  const badge = addCard(card, `ThemeBadge_${theme.id}`, -84, 214, 34, {
    color: badgeColor(theme),
    shadow: false,
    radius: 17,
  });
  addLabel(badge, `ThemeBadgeText_${theme.id}`, badgeText(theme), 0, {
    size: 18,
    color: COLORS.white,
    width: 190,
  });
  const button = card.addComponent(Button);
  button.transition = Button.Transition.NONE;
  card.on(Button.EventType.CLICK, () => onPick(theme));
  bindPressEffect(card);
}

function badgeText(theme: HabitatTheme): string {
  if (currentHabitatTheme().id === theme.id) {
    return COPY.habitatThemeUsing;
  }
  if (isThemeOwned(theme)) {
    return COPY.habitatThemeOwned;
  }
  const lack = themeShortfall(theme);
  return lack > 0 ? fillCopy(COPY.habitatThemeShort, { cost: lack }) : fillCopy(COPY.habitatThemeBuy, { cost: theme.cost });
}

function badgeColor(theme: HabitatTheme) {
  if (currentHabitatTheme().id === theme.id) {
    return COLORS.sage;
  }
  if (isThemeOwned(theme)) {
    return COLORS.mist;
  }
  return themeShortfall(theme) > 0 ? COLORS.danger : COLORS.gold;
}
