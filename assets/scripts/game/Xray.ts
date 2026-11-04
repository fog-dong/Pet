// STATUS: implemented, W25 P1-B 拍片改为刮擦显影（雾气覆盖 + 滑动擦除 + 区域显影判定）；W25 P2-A 追加笔迹级误判计数
import { _decorator, Component, Node } from 'cc';
import type { CaseConfigItem } from '../config/CaseConfig';
import type { AuscultationFinish } from './AuscultationScore';
import { judgeStars } from './AuscultationScore';
import { buildFilm, paintHit, paintLesions, resolveLesions, XrayLesion } from './XrayBoard';
import { FOG_H, FOG_W, XrayFog } from './XrayFog';
import { bindXrayWipe } from './XrayWipe';
import { XrayStroke } from './XrayStroke';
import { DiagnosisHud } from './DiagnosisHud';
import { createNode } from '../ui/SceneUI';
import { Track } from '../track/Track';

const { ccclass } = _decorator;

const TOTAL_MS = 25000;
const WIPE_RADIUS = 52;
const REVEAL_RADIUS = 86;
const REVEAL_RATIO = 0.6;

@ccclass('Xray')
export class Xray extends Component {
  private item: CaseConfigItem | null = null;
  private onFinish: AuscultationFinish | null = null;
  private board: Node | null = null;
  private hud: DiagnosisHud | null = null;
  private fog: XrayFog | null = null;
  private lesions: XrayLesion[] = [];
  private timeLeft = TOTAL_MS;
  private finished = false;
  private settling = false;
  private tolerance = 110;
  /** 笔迹级误判计数：整笔没靠近病灶才算一次，判定口径见 XrayStroke。 */
  private readonly strokes = new XrayStroke(
    () => this.item,
    () => this.finished || this.settling,
  );

  startWith(item: CaseConfigItem, onFinish: AuscultationFinish, setHint?: (text: string) => void): void {
    this.item = item;
    this.onFinish = onFinish;
    const plan = resolveLesions(item);
    this.lesions = plan.lesions;
    this.tolerance = plan.tolerance;
    const root = this.node;
    this.hud = new DiagnosisHud(root, 'Xray', setHint ?? (() => undefined));
    this.board = buildFilm(root);
    // 病灶先挂、雾后盖：红晕只能透出一点，擦开才看得清。
    paintLesions(this.board, this.lesions);
    this.fog = new XrayFog(this.board);
    const layer = createNode(this.board, 'XrayWipeLayer', 0, FOG_W, FOG_H);
    bindXrayWipe(layer, {
      active: () => !this.finished,
      film: () => this.board,
      onWipe: (x, y) => this.scrape(x, y),
      onStrokeStart: () => this.strokes.begin(),
      onStrokeEnd: () => this.closeStroke(),
    });
    this.hud.paint(this.timeLeft);
    Track.track('diagnosis_start', { caseId: item.caseId, type: 'xray', difficulty: item.diagnosisDifficulty });
  }

  /** 抬手后结算这一笔：白擦一次要给玩家即时反馈，光靠星级掉分感知不到后果。 */
  private closeStroke(): void {
    if (!this.strokes.end()) {
      return;
    }
    this.hud?.setHint(`这一片没有病灶，白擦了一次（误判 ${this.strokes.mistakes} 次）`);
  }

  /** 广告提示：擦开病灶上的一小片雾，红晕露出来但还不到判定阈值。 */
  revealHint(): void {
    const target = this.lesions.find((lesion) => !lesion.done);
    if (!target || !this.fog || this.finished || this.settling) {
      return;
    }
    this.fog.wipe(target.x, target.y, WIPE_RADIUS + 12);
    this.fog.flush();
    this.hud?.setHint('雾散开一点了，顺着红晕继续擦');
  }

  protected update(deltaTime: number): void {
    if (this.finished) {
      return;
    }
    this.fog?.flush();
    // 最后一处命中后留 0.65s 定格：让绿色落章和提示看得见，再切治疗页。
    if (this.settling) {
      return;
    }
    this.timeLeft = Math.max(0, this.timeLeft - deltaTime * 1000);
    this.hud?.paint(this.timeLeft);
    if (this.timeLeft <= 0) {
      this.finish(false);
    }
  }

  private scrape(x: number, y: number): void {
    const fog = this.fog;
    if (this.finished || this.settling || !fog) {
      return;
    }
    fog.wipe(x, y, WIPE_RADIUS);
    if (this.lesions.some((lesion) => Math.hypot(lesion.x - x, lesion.y - y) <= this.tolerance)) {
      this.strokes.markNear();
    }
    const found = this.lesions.filter(
      (lesion) => !lesion.done && fog.coverage(lesion.x, lesion.y, REVEAL_RADIUS) >= REVEAL_RATIO,
    );
    if (!found.length) {
      return;
    }
    this.strokes.markNear();
    for (const lesion of found) {
      lesion.done = true;
      paintHit(this.board!, lesion);
      Track.track('diagnosis_action', { caseId: this.item?.caseId ?? '', type: 'xray', result: 'hit' });
    }
    const left = this.lesions.filter((lesion) => !lesion.done).length;
    if (left === 0) {
      this.settling = true;
      this.scheduleOnce(() => this.finish(true), 0.65);
      return;
    }
    this.hud?.setHint(`显影一处病灶，还剩 ${left} 处`);
  }

  private finish(completed: boolean): void {
    if (this.finished) {
      return;
    }
    this.finished = true;
    const timeUsedMs = Math.round(TOTAL_MS - this.timeLeft);
    const mistakes = this.strokes.mistakes;
    // 星级由误判次数 + 用时共同决定：擦错区域不再只是浪费时间，而是会拉低诊断评价。
    const stars = completed ? judgeStars(mistakes, timeUsedMs, TOTAL_MS) : 0;
    this.hud?.setHint(completed ? '就是这里，片子对上了。' : '时间到了，可以重试或看广告获得提示。');
    this.onFinish?.({
      completed,
      stars,
      found: this.lesions.filter((lesion) => lesion.done).length,
      total: this.lesions.length,
      mistakes,
      timeUsedMs,
      totalMs: TOTAL_MS,
    });
  }
}
