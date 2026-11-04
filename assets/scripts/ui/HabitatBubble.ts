// STATUS: implemented, W25 P1-C 点宠物头顶弹出随机治愈气泡（原生 Tween；同时只留一个，连点就换台词）
import { Color, Graphics, Node, tween, UIOpacity, UITransform, Vec3 } from 'cc';
import { COPY } from '../config/CopyText';
import { centerLabel, makeLabel } from './FontKit';
import { COLORS, DURATION } from './Tokens';

const NAME = 'HealBubble';
const HEIGHT = 64;
const MIN_W = 190;
const MAX_W = 340;
/** 22 号字一个字约 22 宽，加左右内边距；宁可宽一点也不要换行破坏气泡形状。 */
const CHAR_W = 22;
const PAD_W = 52;

let lastLine = -1;

/**
 * host 用遮罩层坐标：卡片在滚动容器里，坐标换算由调用方做。
 * 气泡中心落在立绘头顶上方，尾巴朝下指向宠物。
 */
export function showHealBubble(host: Node, x: number, y: number): void {
  const stale = host.getChildByName(NAME);
  if (stale) {
    stale.destroy();
  }
  const text = nextLine();
  const width = Math.min(MAX_W, Math.max(MIN_W, text.length * CHAR_W + PAD_W));
  const node = new Node(NAME);
  node.parent = host;
  node.setPosition(x, y, 0);
  node.addComponent(UITransform).setContentSize(width + 20, HEIGHT + 24);
  const graphics = node.addComponent(Graphics);
  graphics.fillColor = new Color(255, 252, 245, 245);
  graphics.roundRect(-width / 2, -HEIGHT / 2 + 10, width, HEIGHT, 24);
  graphics.fill();
  graphics.moveTo(-9, -HEIGHT / 2 + 11);
  graphics.lineTo(0, -HEIGHT / 2 - 8);
  graphics.lineTo(9, -HEIGHT / 2 + 11);
  graphics.close();
  graphics.fill();
  const label = makeLabel(node, 'HealBubbleText', text, 10, { size: 22, color: COLORS.ink, width: width - 32 });
  centerLabel(label, width - 32, HEIGHT - 12);

  node.setScale(0.72, 0.72, 1);
  const opacity = node.addComponent(UIOpacity);
  opacity.opacity = 0;
  tween(node).to(DURATION.bubbleIn, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
  tween(opacity)
    .to(DURATION.bubbleIn * 0.7, { opacity: 255 })
    .delay(DURATION.bubbleHold)
    .to(DURATION.bubbleOut, { opacity: 0 })
    .start();
  tween(node)
    .delay(DURATION.bubbleIn * 0.7 + DURATION.bubbleHold)
    .by(DURATION.bubbleOut, { position: new Vec3(0, 16, 0) }, { easing: 'quadIn' })
    .call(() => {
      if (node.isValid) {
        node.destroy();
      }
    })
    .start();
}

/** 相邻两次不重复：抽到同一条就顺延一格，免得连点看到同一句。 */
function nextLine(): string {
  const lines = COPY.healBubbleLines;
  let index = Math.floor(Math.random() * lines.length);
  if (index === lastLine) {
    index = (index + 1) % lines.length;
  }
  lastLine = index;
  return lines[index];
}
