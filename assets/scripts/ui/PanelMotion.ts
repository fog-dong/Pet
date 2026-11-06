// STATUS: implemented, W27 P3-UI 模块三 面板开合过渡：遮罩淡入 + 卡片上浮落位，关闭淡出后再销毁
// 口径与 LobbyDock 换页一致：时长只取 Tokens.DURATION，低端机（Quality.low）直接落终态，不留在半路。
import { Node, Tween, UIOpacity, Vec3, tween } from 'cc';
import { Quality } from '../config/Quality';
import { DURATION } from './Tokens';

/** 起幅：从下方 18px、0.97 缩放松手落位——比纯淡入更像"东西被放到桌上"。 */
const RISE = 18;
const FROM_SCALE = 0.97;

/** 遮罩整层淡入（Cocos 的 UIOpacity 会向子节点级联，所以一层就够），卡片与它的影子一起落位。 */
export function enterPanel(overlay: Node, panel: Node): void {
  if (Quality.low) {
    return;
  }
  const mask = opacityOf(overlay);
  mask.opacity = 0;
  tween(mask).to(DURATION.fadeIn, { opacity: 255 }, { easing: 'quadOut' }).start();
  lift(panel);
}

/**
 * 关闭：淡出播完才销毁。这期间遮罩继续吞点击——0.18 秒的输入锁没人感觉得到，
 * 但放开会让点在将亡面板上的按钮误触发一次。中途重开也不冲突，新遮罩后挂，天然压在淡出那层上面。
 */
export function leavePanel(overlay: Node | null): void {
  if (!overlay || !overlay.isValid) {
    return;
  }
  if (Quality.low) {
    overlay.destroy();
    return;
  }
  const mask = opacityOf(overlay);
  Tween.stopAllByTarget(mask);
  tween(mask)
    .to(DURATION.fadeOut, { opacity: 0 }, { easing: 'quadIn' })
    .call(() => {
      if (overlay.isValid) {
        overlay.destroy();
      }
    })
    .start();
}

/** addCard 的影子是卡片的兄弟节点，只缩卡片会让影子在落位前单独露出一块暗角。 */
function lift(panel: Node): void {
  nodesWithShadow(panel).forEach((node) => {
    const home = node.position.clone();
    Tween.stopAllByTarget(node);
    node.setScale(FROM_SCALE, FROM_SCALE, 1);
    node.setPosition(home.x, home.y - RISE, 0);
    tween(node)
      .to(DURATION.card, {
        position: new Vec3(home.x, home.y, 0),
        scale: new Vec3(1, 1, 1),
      }, { easing: 'backOut' })
      .start();
  });
}

function nodesWithShadow(panel: Node): Node[] {
  const shadow = panel.parent?.children.find((child) => child.name === `${panel.name}Shadow`);
  return shadow ? [panel, shadow] : [panel];
}

function opacityOf(node: Node): UIOpacity {
  return node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
}
