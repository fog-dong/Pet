// STATUS: implemented, W25 P2-C 后院面板头部（今日次数摘要 + 草药库存药丸 + 种植/合成页签）
import { Button, Label, Node } from 'cc';
import { todayKey } from '../cache/DayKey';
import { Save } from '../cache/Save';
import { GardenConfig } from '../config/GardenConfig';
import { RecipeConfig } from '../config/RecipeConfig';
import { herbStock } from '../game/GardenModel';
import { quotaUsed } from '../game/GardenRules';
import { addDivider, addPill } from './PanelKit';
import { addGlyphBadge } from './GlyphKit';
import { addLabel } from './SceneUI';
import { fitRow } from './ScreenMetrics';
import { addUIButton, setUIButtonState } from './UIButton';
import { attachButtonIcon } from './ButtonIcon';
import { COLORS, tint } from './Tokens';

export type GardenTab = 'plots' | 'craft';

export interface GardenHeaderHandle {
  refresh(): void;
  setTab(tab: GardenTab): void;
}

const PILL_H = 52;
const PILL_Y = 266;
const TAB_Y = 204;
const TAB_X = 120;

/** 摘要与库存都在头部刷新：作物种类由 garden.json 决定，药丸按种类动态铺满。 */
export function buildGardenHeader(
  parent: Node,
  width: number,
  initialTab: GardenTab,
  onTab: (tab: GardenTab) => void,
): GardenHeaderHandle {
  const summary = addLabel(parent, 'GardenSummary', '', 312, { size: 18, color: COLORS.sub });
  const row = fitRow(GardenConfig.crops.length, -310, 310, 12);
  const pills: Label[] = GardenConfig.crops.map((crop, index) => {
    const pill = addPill(
      parent,
      `GardenHerb_${crop.id}`,
      PILL_Y,
      row.width,
      PILL_H,
      COLORS.white,
      row.x0 + index * row.step,
    );
    // 苗色圆片当库存图标：三种作物一眼分得清，不用读文字。
    addGlyphBadge(pill, `GardenHerbIcon_${crop.id}`, 'sprout', 30, tint(crop.tint), COLORS.white).setPosition(
      -row.width / 2 + 29,
      0,
      0,
    );
    return addLabel(pill, `GardenHerbLabel_${crop.id}`, `${crop.name} ×0`, 0, {
      size: 20,
      width: row.width - 66,
      x: 21,
    });
  });
  const tabs: Button[] = [
    addUIButton(parent, 'GardenTabPlots', '种植', () => onTab('plots'), {
      x: -TAB_X,
      y: TAB_Y,
      width: 220,
      height: 56,
      color: COLORS.clay,
      fontSize: 22,
    }),
    addUIButton(parent, 'GardenTabCraft', '合成', () => onTab('craft'), {
      x: TAB_X,
      y: TAB_Y,
      width: 220,
      height: 56,
      color: COLORS.sage,
      fontSize: 22,
    }),
  ];
  addDivider(parent, 168, width - 90);
  attachButtonIcon(tabs[0], 'sprout');
  attachButtonIcon(tabs[1], 'medicine');
  let tab = initialTab;

  function setTab(next: GardenTab): void {
    tab = next;
    setUIButtonState(tabs[0], true, '种植', tab === 'plots' ? COLORS.clay : COLORS.sage);
    setUIButtonState(tabs[1], true, '合成', tab === 'craft' ? COLORS.clay : COLORS.sage);
  }

  function refresh(): void {
    if (!summary.isValid) {
      return;
    }
    const used = quotaUsed(Save.snapshot().gardenQuota, todayKey());
    summary.string = `今日收获 ${used.harvest}/${GardenConfig.dailyHarvestLimit} · 合成 ${used.craft}/${RecipeConfig.dailyCraftLimit}`;
    herbStock().forEach((entry, index) => {
      const label = pills[index];
      if (label && label.isValid) {
        label.string = `${entry.crop.name} ×${entry.count}`;
      }
    });
  }

  setTab(initialTab);
  refresh();
  return { refresh, setTab };
}
