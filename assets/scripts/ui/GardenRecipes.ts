// STATUS: implemented, W27 P3-UI 合成卡片（左材料 chip + 手绘箭头 + 右产物卡；缺口即时标红，判定全走数据层）
import { Button, Label, Node } from 'cc';
import { todayKey } from '../cache/DayKey';
import { Save } from '../cache/Save';
import { CraftRecipe } from '../config/GardenDefaults';
import { RecipeConfig } from '../config/RecipeConfig';
import { craftRecipe } from '../game/GardenCraft';
import { cropOfHerbId, herbLabel } from '../game/GardenModel';
import { limitLeft, quotaUsed } from '../game/GardenRules';
import { addGlyphBadge } from './GlyphKit';
import { addCard } from './PanelKit';
import { addLabel } from './SceneUI';
import { playStaggerIn } from './MotionKit';
import {
  MATS_W,
  MATS_X,
  OUT_W,
  OUT_X,
  ROW_GAP,
  ROW_H,
  ROW_TOP,
  ROW_W,
  addArrow,
  addRecipePanel,
  productGlyph,
} from './RecipeParts';
import { addUIButton, setUIButtonState } from './UIButton';
import { COLORS, HEX, tint } from './Tokens';

interface RecipeRow {
  card: Node;
  recipe: CraftRecipe;
  materials: Label[];
  button: Button;
}

export interface GardenRecipesHandle {
  sync(): void;
}

export function buildGardenRecipes(
  parent: Node,
  notify: (text: string) => void,
  changed: () => void,
): GardenRecipesHandle {
  let refresh = (): void => {};
  const rows = RecipeConfig.recipes.map((recipe, index) =>
    buildRow(parent, recipe, index, () => {
      const result = craftRecipe(recipe.id);
      notify(result.text);
      if (result.kind === 'done') {
        changed();
      } else {
        refresh();
      }
    }),
  );
  refresh = (): void => {
    const used = quotaUsed(Save.snapshot().gardenQuota, todayKey());
    const left = limitLeft(used.craft, RecipeConfig.dailyCraftLimit);
    rows.forEach((row) => syncRow(row, left));
  };
  refresh();
  playStaggerIn(rows.map((row) => row.card));
  return { sync: refresh };
}

/** 一张配方卡：左边材料清单，中间箭头，右边产物与工本，最右侧才是合成键。 */
function buildRow(parent: Node, recipe: CraftRecipe, index: number, onClick: () => void): RecipeRow {
  const y = ROW_TOP - index * (ROW_H + ROW_GAP);
  const card = addCard(parent, `GardenRecipe_${recipe.id}`, y, ROW_W, ROW_H, { color: COLORS.paper, shadow: false });
  const mats = addRecipePanel(card, 'Mats', MATS_X, MATS_W, tint(HEX.cream));
  const materials = recipe.ins.map((entry, slot) => {
    const rowY = recipe.ins.length === 1 ? 0 : slot === 0 ? 20 : -20;
    const crop = cropOfHerbId(entry.item);
    addGlyphBadge(mats, `Mat_${recipe.id}_${entry.item}`, 'sprout', 26, tint(crop ? crop.tint : HEX.sage), COLORS.white).setPosition(
      -MATS_W / 2 + 21,
      rowY,
      0,
    );
    return addLabel(mats, `MatLabel_${recipe.id}_${entry.item}`, '', rowY, {
      size: 18,
      width: 146,
      x: 20,
      align: Label.HorizontalAlign.LEFT,
    });
  });
  addArrow(card, -66);
  const out = addRecipePanel(card, 'Out', OUT_X, OUT_W, tint(HEX.clay, 36));
  addGlyphBadge(out, 'OutIcon', productGlyph(recipe.out), 34, COLORS.clay, COLORS.white).setPosition(-OUT_W / 2 + 26, 4, 0);
  addLabel(out, 'OutName', `${recipe.name} ×${recipe.outQty}`, 18, {
    size: 20,
    width: 138,
    x: 26,
    align: Label.HorizontalAlign.LEFT,
  });
  addLabel(out, 'OutCost', recipe.coins > 0 ? `工本 ${recipe.coins} 金币` : '不收工本', -16, {
    size: 15,
    color: COLORS.sub,
    width: 138,
    x: 26,
    align: Label.HorizontalAlign.LEFT,
  });
  const button = addUIButton(card, `GardenCraftBtn_${recipe.id}`, '合成', onClick, {
    x: 235,
    y: 0,
    width: 110,
    height: 62,
    color: COLORS.clay,
    fontSize: 21,
  });
  return { card, recipe, materials, button };
}

/** 缺口写进材料行（`薄荷 1/2`）并标红，按钮只负责置灰；文案保留动作名（W24-1 口径）。 */
function syncRow(row: RecipeRow, left: number): void {
  let affordable = left > 0 && Save.coins >= row.recipe.coins;
  row.recipe.ins.forEach((entry, index) => {
    const have = Save.itemCount(entry.item);
    const enough = have >= entry.count;
    if (!enough) {
      affordable = false;
    }
    const label = row.materials[index];
    if (label && label.isValid) {
      label.string = `${herbLabel(entry.item)} ${have}/${entry.count}`;
      label.color = enough ? COLORS.ink : COLORS.danger;
    }
  });
  setUIButtonState(row.button, affordable, '合成', COLORS.clay);
}
