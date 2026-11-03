// STATUS: implemented, W25 P0-B 小屋属性圆钮的图标绘制（骨头 / 泡泡 / 爱心，形状与粒子共用 ParticleKit 的同一套矢量）
// 单独成文件的唯一理由是守住 150 行红线（HabitatBars 里只剩布局与透明度状态）；描边色由调用方传入，避免反向依赖。
import { Color, Graphics } from 'cc';
import { HabitatStatKey } from '../game/HabitatRules';
import { drawBone, drawBubble, drawHeart } from './ParticleKit';
import { HEX, tint } from './Tokens';

/** 圆盘底色：三条属性各取同色系的浅档，米色卡上才读得出「这是一枚能点的按钮」。 */
export const DISC_TINT: Record<HabitatStatKey, Color> = {
  hunger: tint(HEX.gold, 64),
  cleanliness: tint(HEX.mist, 70),
  mood: tint(HEX.clay, 60),
};

/** 泡泡只描边才读得出"透明"，其余两枚实心；骨头本身最宽，缩到 0.78 才不顶到圆盘边。 */
export function paintStatGlyph(key: HabitatStatKey, g: Graphics): void {
  if (key === 'hunger') {
    g.node.setScale(0.78, 0.78, 1);
    drawBone(g);
    return;
  }
  if (key === 'cleanliness') {
    drawBubble(g, 13);
    return;
  }
  drawHeart(g, 15);
}
