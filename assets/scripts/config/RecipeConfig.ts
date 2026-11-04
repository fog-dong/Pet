// STATUS: implemented, W25 P2-C 合成配方加载（recipes.json 为唯一口径；缺配/整表不合法回落内置同值并 Track）
import { loadConfigJson } from './ConfigLoader';
import { CraftRecipe, RecipeData, RecipeIngredient, RECIPE_FALLBACK } from './GardenDefaults';
import { Track } from '../track/Track';

interface RecipeFile {
  version?: number;
  dailyCraftLimit?: unknown;
  recipes?: unknown;
}

function intOf(value: unknown, fallback: number, min = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.floor(value));
}

/** ins 在表里是 `[{ "herb_mint": 2 }, …]`：按单键对象读，兼容一份材料写多项；重复材料合并数量。 */
function ingredientsOf(raw: unknown): RecipeIngredient[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const result: RecipeIngredient[] = [];
  raw.forEach((group) => {
    if (!group || typeof group !== 'object') {
      return;
    }
    Object.keys(group as Record<string, unknown>).forEach((item) => {
      const value = (group as Record<string, unknown>)[item];
      if (!item || typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        return;
      }
      const hit = result.find((entry) => entry.item === item);
      if (hit) {
        hit.count += Math.floor(value);
      } else {
        result.push({ item, count: Math.floor(value) });
      }
    });
  });
  return result;
}

function recipeOf(raw: unknown): CraftRecipe | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const item = raw as Partial<CraftRecipe>;
  if (typeof item.id !== 'string' || !item.id || typeof item.out !== 'string' || !item.out) {
    return null;
  }
  const ins = ingredientsOf(item.ins);
  if (ins.length === 0) {
    return null;
  }
  return {
    id: item.id,
    name: typeof item.name === 'string' && item.name ? item.name : item.id,
    out: item.out,
    outQty: intOf(item.outQty, 1, 1),
    ins,
    coins: intOf(item.coins, 0),
  };
}

class RecipeConfigStore {
  private data: RecipeData = RECIPE_FALLBACK;
  private ready = false;

  get dailyCraftLimit(): number {
    return this.data.dailyCraftLimit;
  }

  get recipes(): readonly CraftRecipe[] {
    return this.data.recipes;
  }

  get loaded(): boolean {
    return this.ready;
  }

  recipeById(id: string): CraftRecipe | null {
    return this.data.recipes.find((recipe) => recipe.id === id) ?? null;
  }

  async load(): Promise<boolean> {
    if (this.ready) {
      return true;
    }
    const file = await loadConfigJson<RecipeFile>('config/recipes');
    if (!file) {
      Track.track('config_missing', { key: 'recipes' });
      return false;
    }
    const recipes: CraftRecipe[] = [];
    if (Array.isArray(file.recipes)) {
      file.recipes.forEach((raw) => {
        const recipe = recipeOf(raw);
        if (recipe && !recipes.some((entry) => entry.id === recipe.id)) {
          recipes.push(recipe);
        }
      });
    }
    if (recipes.length === 0) {
      Track.track('config_invalid', { key: 'recipes' });
      return false;
    }
    this.data = {
      dailyCraftLimit: intOf(file.dailyCraftLimit, RECIPE_FALLBACK.dailyCraftLimit),
      recipes,
    };
    this.ready = true;
    return true;
  }
}

export const RecipeConfig = new RecipeConfigStore();
