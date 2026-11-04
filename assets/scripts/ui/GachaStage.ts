// STATUS: implemented, W25 P1-A 寻访舞台（街景 + 纸箱抖动 + 开箱弹宠，全部原生 Tween）
import { Graphics, Label, Node, Tween, UIOpacity, UITransform, Vec3, tween } from 'cc';
import { COPY } from '../config/CopyText';
import { Quality } from '../config/Quality';
import type { GachaDraw } from '../game/Gacha';
import { makeLabel } from './FontKit';
import { buildGachaBox, GachaBoxHandle, paintStreet } from './GachaArt';
import { addPill } from './PanelKit';
import { bindGachaReveal, GachaRevealHandle } from './GachaReveal';
import { addLabel } from './SceneUI';
import { rightEdgeX, safeAreaTop, screenHeight, screenWidth } from './ScreenMetrics';
import { COLORS, tint } from './Tokens';

const BOX_Y = -110;
const PET_Y = 128;
const GOLD = '#E3B23C';

export interface GachaStageHandle {
  root: Node;
  setCoins(coins: number): void;
  setHint(text: string): void;
  playEnter(): void;
  beginSearch(): void;
  reveal(draw: GachaDraw, onDone: () => void): void;
  reset(): void;
}

export function mountGachaStage(parent: Node, onBoxTap: () => void): GachaStageHandle {
  const width = screenWidth();
  const height = screenHeight();
  const root = new Node('GachaStage');
  root.parent = parent;
  root.addComponent(UITransform).setContentSize(width, height);
  paintStreet(root);
  const top = height / 2 - safeAreaTop();
  addLabel(root, 'GachaTitle', COPY.gachaTitle, top - 96, { size: 40 });
  addLabel(root, 'GachaSubtitle', COPY.gachaSubtitle, top - 146, { size: 22, color: COLORS.sub });
  const coins = mountCoins(root, top - 42);
  // 出价区多了稀有券一行（bottom+260），提示抬到 +322 保持 10px 间距。
  const hint = addLabel(root, 'GachaHint', COPY.gachaReady, -height / 2 + 322, {
    size: 22,
    color: COLORS.sub,
    width: 620,
  });
  const box: GachaBoxHandle = buildGachaBox(root, onBoxTap);
  box.root.setPosition(0, BOX_Y, 0);
  const reveal: GachaRevealHandle = bindGachaReveal(root, PET_Y, GOLD);
  const opacity = root.addComponent(UIOpacity);

  function stopShake(): void {
    Tween.stopAllByTarget(box.root);
    box.root.angle = 0;
  }

  return {
    root,
    setCoins: (value: number) => {
      coins.string = `${value}`;
    },
    setHint: (text: string) => {
      hint.string = text;
    },
    playEnter: () => {
      opacity.opacity = 0;
      root.setScale(1.12, 1.12, 1);
      tween(opacity).to(0.18, { opacity: 255 }).start();
      tween(root).to(0.32, { scale: Vec3.ONE }, { easing: 'quadOut' }).start();
    },
    beginSearch: () => {
      stopShake();
      if (Quality.low) {
        tween(box.root).to(0.08, { angle: 3 }).to(0.16, { angle: -3 }).to(0.08, { angle: 0 }).start();
        return;
      }
      tween(box.root)
        .repeatForever(
          tween(box.root)
            .to(0.09, { angle: 3.5 })
            .to(0.18, { angle: -3.5 })
            .to(0.09, { angle: 0 })
            .delay(0.28),
        )
        .start();
    },
    reveal: (draw: GachaDraw, onDone: () => void) => {
      stopShake();
      reveal.reveal(draw, box, onDone);
    },
    reset: () => {
      stopShake();
      reveal.reset(box);
    },
  };
}

function mountCoins(parent: Node, y: number): Label {
  const pill = addPill(parent, 'GachaCoins', y, 208, 48, COLORS.paper, rightEdgeX(104, 24));
  const coin = new Node('GachaCoinIcon');
  coin.parent = pill;
  coin.setPosition(-78, 0, 0);
  coin.addComponent(UITransform).setContentSize(36, 36);
  const g = coin.addComponent(Graphics);
  g.fillColor = tint(GOLD);
  g.circle(0, 0, 15);
  g.fill();
  g.strokeColor = tint('#C08C22');
  g.lineWidth = 2;
  g.circle(0, 0, 15);
  g.stroke();
  g.fillColor = tint('#FBF0D2');
  g.circle(0, 0, 8);
  g.fill();
  const label = makeLabel(pill, 'GachaCoinsLabel', '0', 0, { size: 22, color: COLORS.ink, width: 150 });
  label.node.setPosition(16, 0, 0);
  return label;
}
