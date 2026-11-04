// STATUS: implemented, W25 P1-B 听诊节奏视图（固定金圈 + 缩放波纹 + 连击与判定反馈）
import { Color, Graphics, Label, Node, Tween, UIOpacity, Vec3, tween } from 'cc';
import { Quality } from '../config/Quality';
import { addLabel, addRect, createNode, PALETTE } from '../ui/SceneUI';
import { COLORS } from '../ui/Tokens';
import type { AuscultationRhythm, RhythmGrade } from './AuscultationRhythm';
import { PetVisual } from './PetVisual';

const BOARD_W = 560;
const BOARD_H = 460;
const RING_RADIUS = 120;
const PET_SIZE = 280;

function paintRing(node: Node, color: Color, width: number): void {
  const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics);
  graphics.clear();
  graphics.lineWidth = width;
  graphics.strokeColor = color;
  graphics.circle(0, 0, RING_RADIUS);
  graphics.stroke();
}

export class AuscultationRhythmView {
  private readonly board: Node;
  private readonly ring: Node;
  private readonly ripple: Node;
  private readonly flash: Node;
  private readonly flashOpacity: UIOpacity;
  private readonly combo: Label;
  private readonly judgeLabel: Label;
  private readonly progress: Label;
  private beatSeen = -1;

  constructor(parent: Node, petId: string, onTap: () => void) {
    this.board = addRect(parent, 'RhythmBoard', 0, BOARD_W, BOARD_H, COLORS.cream);
    PetVisual.mount(this.board, PET_SIZE).apply(petId);
    this.ring = createNode(this.board, 'RhythmRing', 0, RING_RADIUS * 2, RING_RADIUS * 2);
    paintRing(this.ring, COLORS.gold, 7);
    this.ripple = createNode(this.board, 'RhythmRipple', 0, RING_RADIUS * 2, RING_RADIUS * 2);
    paintRing(this.ripple, COLORS.sage, 5);
    this.flash = createNode(this.board, 'RhythmFlash', 0, RING_RADIUS * 2, RING_RADIUS * 2);
    paintRing(this.flash, COLORS.clay, 8);
    this.flashOpacity = this.flash.addComponent(UIOpacity);
    this.flashOpacity.opacity = 0;
    this.combo = addLabel(this.board, 'RhythmCombo', '', 196, {
      size: 30, color: PALETTE.primary, width: 440,
    });
    this.judgeLabel = addLabel(this.board, 'RhythmJudge', '', 152, {
      size: 26, color: PALETTE.sub, width: 440,
    });
    this.progress = addLabel(this.board, 'RhythmProgress', '', -BOARD_H / 2 + 30, {
      size: 22, color: PALETTE.sub,
    });
    // 整块棋盘都能点：判定按时间算，不要求点中环。
    this.board.on(Node.EventType.TOUCH_END, onTap);
  }

  paintFrame(rhythm: AuscultationRhythm): void {
    this.ripple.active = rhythm.traveling;
    if (rhythm.traveling) {
      this.ripple.setScale(rhythm.ripple, rhythm.ripple, 1);
    }
    this.combo.string = rhythm.combo > 0 ? `连击 ×${rhythm.combo}` : '';
    this.progress.string = `心跳 ${rhythm.hits}/${rhythm.rule.beats}`;
    if (rhythm.beatIndex !== this.beatSeen) {
      this.beatSeen = rhythm.beatIndex;
      this.pulseRing();
    }
  }

  judge(grade: RhythmGrade): void {
    this.judgeLabel.string = grade === 'perfect' ? '完美！' : grade === 'good' ? '不错，接住了' : '漏了一拍';
    this.judgeLabel.color = grade === 'miss' ? COLORS.danger : grade === 'perfect' ? COLORS.gold : COLORS.sage;
    Tween.stopAllByTarget(this.judgeLabel.node);
    this.judgeLabel.node.setScale(1, 1, 1);
    tween(this.judgeLabel.node)
      .to(0.08, { scale: new Vec3(1.14, 1.14, 1) })
      .to(0.18, { scale: Vec3.ONE }, { easing: 'backOut' })
      .start();
    if (grade === 'miss') {
      this.shake();
      return;
    }
    this.flashOpacity.opacity = 255;
    this.flash.setScale(1, 1, 1);
    Tween.stopAllByTarget(this.flash);
    Tween.stopAllByTarget(this.flashOpacity);
    tween(this.flash).to(0.34, { scale: new Vec3(1.45, 1.45, 1) }, { easing: 'quadOut' }).start();
    tween(this.flashOpacity).to(0.34, { opacity: 0 }, { easing: 'quadIn' }).start();
  }

  say(text: string): void {
    this.judgeLabel.string = text;
    this.judgeLabel.color = PALETTE.sub;
  }

  private pulseRing(): void {
    if (Quality.low) {
      return;
    }
    Tween.stopAllByTarget(this.ring);
    this.ring.setScale(1, 1, 1);
    tween(this.ring)
      .to(0.09, { scale: new Vec3(1.06, 1.06, 1) })
      .to(0.18, { scale: Vec3.ONE }, { easing: 'quadOut' })
      .start();
  }

  private shake(): void {
    if (Quality.low) {
      return;
    }
    Tween.stopAllByTarget(this.board);
    tween(this.board)
      .to(0.05, { position: new Vec3(-8, 0, 0) })
      .to(0.05, { position: new Vec3(8, 0, 0) })
      .to(0.05, { position: Vec3.ZERO })
      .start();
  }
}
