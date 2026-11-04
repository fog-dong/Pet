// STATUS: implemented, W25 P2-C 合成列表（材料现存量/缺口即时可见；每日次数与库存判定全走数据层）
import { Button, Label, Node } from 'cc';
import { todayKey } from '../cache/DayKey';
import { Save } from '../cache/Save';
import { CraftRecipe } from '../config/GardenDefaults';
import { RecipeConfig } from '../config/RecipeConfig';
import { craftRecipe } from '../game/GardenCraft';
import { herbLabel } from '../game/GardenModel';
import { limitLeft, quotaUsed } from '../game/GardenRules';
import { addCard } from './PanelKit';
import { addLabel } from './SceneUI';
import { addUIButton, setUIButtonState } from './UIButton';
import { COLORS } from './Tokens';

const ROW_W = 590;
const ROW_H = 118;
const ROW_GAP = 12;
const ROW_TOP = 130;

interface RecipeRow {
  recipe: CraftRecipe;
  need: Label;
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
  return { sync: refresh };
}

function buildRow(parent: Node, recipe: CraftRecipe, index: number, onClick: () => void): RecipeRow {
  const y = ROW_TOP - index * (ROW_H + ROW_GAP);
  const card = addCard(parent, `GardenRecipe_${recipe.id}`, y, ROW_W, ROW_H, { color: COLORS.paper, shadow: false });
  // 左对齐标签的锚点在节点中心：要让文字左沿落在 -275，x 必须再加半个宽度。
  addLabel(card, `GardenRecipeName_${recipe.id}`, `${recipe.name} ×${recipe.outQty}`, 32, {
    size: 24,
    width: 260,
    x: -145,
    align: Label.HorizontalAlign.LEFT,
  });
  const need = addLabel(card, `GardenRecipeNeed_${recipe.id}`, '', -6, {
    size: 17,
    color: COLORS.sub,
    width: 360,
    x: -95,
    align: Label.HorizontalAlign.LEFT,
  });
  addLabel(card, `GardenRecipeCost_${recipe.id}`, recipe.coins > 0 ? `工本 ${recipe.coins} 金币` : '不收工本', -36, {
    size: 16,
    color: COLORS.sub,
    width: 360,
    x: -95,
    align: Label.HorizontalAlign.LEFT,
  });
  const button = addUIButton(card, `GardenCraftBtn_${recipe.id}`, '合成', onClick, {
    x: 200,
    y: 0,
    width: 150,
    height: 62,
    color: COLORS.clay,
    fontSize: 22,
  });
  return { recipe, need, button };
}

/** 缺口写进材料行（`薄荷 1/2`），按钮只负责置灰；文案保留动作名（W24-1 口径）。 */
function syncRow(row: RecipeRow, left: number): void {
  let affordable = left > 0 && Save.coins >= row.recipe.coins;
  row.need.string = row.recipe.ins
    .map((entry) => {
      const have = Save.itemCount(entry.item);
      if (have < entry.count) {
        affordable = false;
      }
      return `${herbLabel(entry.item)} ${have}/${entry.count}`;
    })
    .join(' · ');
  setUIButtonState(row.button, affordable, '合成', COLORS.clay);
}
