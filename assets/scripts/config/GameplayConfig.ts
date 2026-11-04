// STATUS: implemented, W25 P2-C 玩法配置批量加载入口（Boot 只挂一个开关；各表缺配自行 Track，互不阻塞）
import { GachaConfig } from './GachaConfig';
import { GardenConfig } from './GardenConfig';
import { GroomingConfig } from './GroomingConfig';
import { RecipeConfig } from './RecipeConfig';
import { RehomeConfig } from './RehomeConfig';

/**
 * 全部成功才返回 true；单表缺失只影响对应玩法，各自已留痕，不静默改口径。
 * gacha 档位是送养感谢金的计价依据，必须在 Boot 就绪——否则没开过寻访的玩家会把在屋宠物误判成「不在小屋里」。
 */
export function loadGameplayConfigs(): Promise<boolean> {
  return Promise.all([
    GardenConfig.load(),
    RecipeConfig.load(),
    GroomingConfig.load(),
    RehomeConfig.load(),
    GachaConfig.load(),
  ]).then(([gardenReady, recipeReady, groomingReady, rehomeReady, gachaReady]) =>
    gardenReady && recipeReady && groomingReady && rehomeReady && gachaReady,
  );
}
