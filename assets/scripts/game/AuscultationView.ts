// STATUS: implemented, W3 听诊棋盘（宠物色块身体 + 可点热区 + 高亮/闪烁）
import { Color, Graphics, Label, Node, Tween, tween, Vec3 } from 'cc';
import type { AuscultationLayout, AuscultationSpotDef } from '../config/AuscultationConfig';
import { Quality } from '../config/Quality';
import { addLabel, addRect, createNode, PALETTE } from '../ui/SceneUI';

const BOARD_W = 560;
const BOARD_H = 460;
const BODY_W = 320;
const BODY_H = 380;
const SPOT_RADIUS = 34;
const SPOT_IDLE = new Color(255, 255, 255, 70);
const SPOT_FOUND = new Color(127, 183, 126, 255);
const SPOT_WRONG = new Color(214, 106, 96, 255);
const SPOT_SPENT = new Color(198, 192, 184, 200);

export interface SpotView {
  def: AuscultationSpotDef;
  abnormal: boolean;
  node: Node;
  graphics: Graphics;
  resolved: boolean;
}

export class AuscultationView {
  readonly spots: SpotView[] = [];
  private progress: Label | null = null;

  constructor(
    parent: Node,
    bodyColor: Color,
    layout: AuscultationLayout,
    onTap: (spot: SpotView) => void,
  ) {
    const board = addRect(parent, 'AuscultationBoard', 0, BOARD_W, BOARD_H, new Color(250, 246, 239, 255));
    const body = createNode(board, 'Body', 10, BODY_W, BODY_H);
    const graphics = body.addComponent(Graphics);
    graphics.fillColor = bodyColor;
    graphics.ellipse(0, 0, BODY_W / 2, BODY_H / 2);
    graphics.fill();
    layout.abnormal.forEach((def) => this.spots.push(this.build(body, def, true, onTap)));
    layout.distractors.forEach((def) => this.spots.push(this.build(body, def, false, onTap)));
    this.progress = addLabel(board, 'Progress', '', -BOARD_H / 2 + 30, {
      size: 22,
      color: PALETTE.sub,
    });
  }

  setProgress(text: string): void {
    if (this.progress) {
      this.progress.string = text;
    }
  }

  /** 画质切换：先收掉所有循环脉冲；high 档再给已发现的异常点恢复提示。 */
  applyQuality(): void {
    for (const spot of this.spots) {
      Tween.stopAllByTarget(spot.node);
      spot.node.setScale(Vec3.ONE);
      if (!Quality.low && spot.resolved && spot.abnormal) {
        this.pulse(spot);
      }
    }
  }

  markFound(spot: SpotView): void {
    spot.resolved = true;
    this.paint(spot, SPOT_FOUND);
    this.pulse(spot);
  }

  markWrong(spot: SpotView): void {
    spot.resolved = true;
    this.paint(spot, SPOT_WRONG);
    tween(spot.node)
      .delay(0.3)
      .call(() => this.paint(spot, SPOT_SPENT))
      .start();
  }

  /** 广告 / 道具给出的线索：点亮一个未发现的异常点一段时间。 */
  revealHint(spot: SpotView, durationMs = 3000): void {
    if (spot.resolved) {
      return;
    }
    this.paint(spot, SPOT_FOUND);
    this.pulse(spot);
    tween(spot.node)
      .delay(durationMs / 1000)
      .call(() => {
        Tween.stopAllByTarget(spot.node);
        spot.node.setScale(Vec3.ONE);
        this.paint(spot, SPOT_IDLE);
      })
      .start();
  }

  private build(
    parent: Node,
    def: AuscultationSpotDef,
    abnormal: boolean,
    onTap: (spot: SpotView) => void,
  ): SpotView {
    const node = createNode(parent, `Spot_${def.id}`, def.y, SPOT_RADIUS * 2, SPOT_RADIUS * 2);
    node.setPosition(def.x, def.y, 0);
    const view: SpotView = {
      def,
      abnormal,
      node,
      graphics: node.addComponent(Graphics),
      resolved: false,
    };
    this.paint(view, SPOT_IDLE);
    node.on(Node.EventType.TOUCH_END, () => {
      if (!view.resolved) {
        onTap(view);
      }
    });
    return view;
  }

  private pulse(spot: SpotView): void {
    if (Quality.low) {
      return;
    }
    Tween.stopAllByTarget(spot.node);
    spot.node.setScale(Vec3.ONE);
    tween(spot.node)
      .to(0.3, { scale: new Vec3(1.16, 1.16, 1) })
      .to(0.3, { scale: Vec3.ONE })
      .union()
      .repeatForever()
      .start();
  }

  private paint(spot: SpotView, color: Color): void {
    const graphics = spot.graphics;
    graphics.clear();
    graphics.fillColor = color;
    graphics.circle(0, 0, SPOT_RADIUS);
    graphics.fill();
    graphics.lineWidth = 2;
    graphics.strokeColor = new Color(255, 255, 255, 150);
    graphics.circle(0, 0, SPOT_RADIUS);
    graphics.stroke();
  }
}
