// STATUS: implemented, W25 P2-C 玩法配置批量加载入口（Boot 只挂一个开关；各表缺配自行 Track，互不阻塞）
import { GardenConfig } from './GardenConfig';
import { GroomingConfig } from './GroomingConfig';
import { RecipeConfig } from './RecipeConfig';

/** 全部成功才返回 true；单表缺失只影响对应玩法，各自已留痕，不静默改口径。 */
export function loadGameplayConfigs(): Promise<boolean> {
  return Promise.all([GardenConfig.load(), RecipeConfig.load(), GroomingConfig.load()]).then(
    ([gardenReady, recipeReady, groomingReady]) => gardenReady && recipeReady && groomingReady,
  );
}
