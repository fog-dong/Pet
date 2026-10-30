// STATUS: implemented, W4 拍片小游戏（拖拽标记框找病灶，卡通占位，04 §4）
import { _decorator, Component, Node } from 'cc';
import type { CaseConfigItem } from '../config/CaseConfig';
import type { AuscultationFinish } from './AuscultationScore';
import { judgeStars } from './AuscultationScore';
import {
  buildFilm,
  buildMarker,
  paintClue,
  paintHit,
  resolveLesions,
  XRAY_START_Y,
  XrayLesion,
} from './XrayBoard';
import { bindXrayDrag } from './XrayDrag';
import { DiagnosisHud } from './DiagnosisHud';
import { Track } from '../track/Track';

const { ccclass } = _decorator;

const TOTAL_MS = 25000;
const PENALTY_MS = 5000;

@ccclass('Xray')
export class Xray extends Component {
  private item: CaseConfigItem | null = null;
  private onFinish: AuscultationFinish | null = null;
  private board: Node | null = null;
  private marker: Node | null = null;
  private hud: DiagnosisHud | null = null;
  private clue: Node | null = null;
  private lesions: XrayLesion[] = [];
  private tolerance = 90;
  private mistakes = 0;
  private timeLeft = TOTAL_MS;
  private finished = false;

  startWith(item: CaseConfigItem, onFinish: AuscultationFinish, setHint?: (text: string) => void): void {
    this.item = item;
    this.onFinish = onFinish;
    const plan = resolveLesions(item);
    this.lesions = plan.lesions;
    this.tolerance = plan.tolerance;
    const root = this.node;
    this.hud = new DiagnosisHud(root, 'Xray', setHint ?? (() => undefined));
    this.board = buildFilm(root);
    this.marker = buildMarker(this.board);
    bindXrayDrag(this.marker, {
      active: () => !this.finished,
      board: () => this.board,
      marker: () => this.marker,
      onDrop: () => this.dropMarker(),
      onCancel: () => undefined,
    });
    this.hud.paint(this.timeLeft);
    Track.track('diagnosis_start', { caseId: item.caseId, type: 'xray', difficulty: item.diagnosisDifficulty });
  }

  /** 广告提示：在未找到的病灶外画一个 3 秒圆圈。 */
  revealHint(): void {
    const target = this.lesions.find((lesion) => !lesion.done);
    if (!target || !this.board || this.finished) {
      return;
    }
    this.clue?.destroy();
    const node = paintClue(this.board, target);
    this.clue = node;
    this.scheduleOnce(() => node.destroy(), 3);
  }

  protected update(deltaTime: number): void {
    if (this.finished) {
      return;
    }
    this.timeLeft = Math.max(0, this.timeLeft - deltaTime * 1000);
    this.hud?.paint(this.timeLeft);
    if (this.timeLeft <= 0) {
      this.finish(false);
    }
  }

  private dropMarker(): void {
    const marker = this.marker;
    if (this.finished || !marker) {
      return;
    }
    const position = marker.position;
    const hit = this.lesions.find(
      (lesion) => !lesion.done && Math.hypot(lesion.x - position.x, lesion.y - position.y) <= this.tolerance,
    );
    if (!hit) {
      this.mistakes += 1;
      this.timeLeft = Math.max(0, this.timeLeft - PENALTY_MS);
      this.hud?.paint(this.timeLeft);
      this.hud?.setHint('再对比一下左右两侧');
      marker.setPosition(0, XRAY_START_Y, 0);
      this.trackAction('miss');
      return;
    }
    hit.done = true;
    marker.setPosition(hit.x, hit.y, 0);
    paintHit(this.board!, hit);
    this.trackAction('hit');
    if (this.lesions.every((lesion) => lesion.done)) {
      this.finish(true);
    }
  }

  private trackAction(result: 'hit' | 'miss'): void {
    Track.track('diagnosis_action', { caseId: this.item?.caseId ?? '', type: 'xray', result });
  }

  private finish(completed: boolean): void {
    if (this.finished) {
      return;
    }
    this.finished = true;
    const timeUsedMs = Math.round(TOTAL_MS - this.timeLeft);
    const stars = completed ? judgeStars(this.mistakes, timeUsedMs, TOTAL_MS) : 0;
    this.hud?.setHint(completed ? '就是这里，片子对上了。' : '时间到了，可以重试或看广告获得提示。');
    this.onFinish?.({
      completed,
      stars,
      found: this.lesions.filter((lesion) => lesion.done).length,
      total: this.lesions.length,
      mistakes: this.mistakes,
      timeUsedMs,
      totalMs: TOTAL_MS,
    });
  }
}
