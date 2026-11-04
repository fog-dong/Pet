// STATUS: implemented, W25 P1-B 听诊节奏模型（每拍波纹收进判定环，连击决定星级；不依赖 cc 节点）
import type { CaseConfigItem } from '../config/CaseConfig';

export type RhythmGrade = 'perfect' | 'good' | 'miss';

export interface RhythmRule {
  beats: number;
  periodMs: number;
  gapMs: number;
  perfectMs: number;
  goodMs: number;
}

/** 波纹缩放：1 = 判定环。视图与判定共用同一组换算，避免两边对不上。 */
export const RIPPLE_START = 1.46;
export const RIPPLE_END = 0.52;
export const CROSS_RATIO = (RIPPLE_START - 1) / (RIPPLE_START - RIPPLE_END);

const RULES: Record<number, RhythmRule> = {
  1: { beats: 5, periodMs: 1600, gapMs: 360, perfectMs: 110, goodMs: 220 },
  2: { beats: 6, periodMs: 1500, gapMs: 350, perfectMs: 100, goodMs: 210 },
  3: { beats: 7, periodMs: 1400, gapMs: 340, perfectMs: 95, goodMs: 200 },
  4: { beats: 8, periodMs: 1300, gapMs: 330, perfectMs: 90, goodMs: 190 },
  5: { beats: 9, periodMs: 1200, gapMs: 320, perfectMs: 85, goodMs: 180 },
};

export function rhythmRule(item: CaseConfigItem): RhythmRule {
  const level = Math.max(1, Math.min(5, Math.round(item.diagnosisDifficulty || 1)));
  return RULES[level] ?? RULES[1];
}

export class AuscultationRhythm {
  readonly rule: RhythmRule;
  private beat = 0;
  private elapsed = 0;
  private pauseLeft = 0;
  private resolved = false;
  private state: 'travel' | 'pause' | 'done' = 'travel';
  private comboValue = 0;
  private maxComboValue = 0;
  private hitCount = 0;
  private missCount = 0;

  constructor(rule: RhythmRule) {
    this.rule = rule;
  }

  get beatIndex(): number {
    return this.beat;
  }

  get combo(): number {
    return this.comboValue;
  }

  get maxCombo(): number {
    return this.maxComboValue;
  }

  get hits(): number {
    return this.hitCount;
  }

  get misses(): number {
    return this.missCount;
  }

  get done(): boolean {
    return this.state === 'done';
  }

  get traveling(): boolean {
    return this.state === 'travel' && !this.resolved;
  }

  /** 波纹当前缩放：1 时正好贴合判定环。 */
  get ripple(): number {
    if (this.state !== 'travel') {
      return RIPPLE_END;
    }
    const progress = Math.min(1, this.elapsed / this.rule.periodMs);
    return RIPPLE_START - (RIPPLE_START - RIPPLE_END) * progress;
  }

  tap(): RhythmGrade | null {
    if (!this.traveling) {
      return null;
    }
    const error = this.elapsed - this.rule.periodMs * CROSS_RATIO;
    if (error < -this.rule.goodMs) {
      return this.settle('miss');
    }
    if (Math.abs(error) <= this.rule.perfectMs) {
      return this.settle('perfect');
    }
    return this.settle('good');
  }

  /** 广告提示：把当前这一拍按完美接上。 */
  autoHit(): RhythmGrade | null {
    return this.traveling ? this.settle('perfect') : null;
  }

  update(deltaMs: number): RhythmGrade | null {
    if (this.state === 'done') {
      return null;
    }
    if (this.state === 'pause') {
      this.pauseLeft -= deltaMs;
      if (this.pauseLeft <= 0) {
        this.nextBeat();
      }
      return null;
    }
    this.elapsed += deltaMs;
    if (!this.resolved && this.elapsed > this.rule.periodMs * CROSS_RATIO + this.rule.goodMs) {
      return this.settle('miss');
    }
    return null;
  }

  private settle(grade: RhythmGrade): RhythmGrade {
    this.resolved = true;
    if (grade === 'miss') {
      this.missCount += 1;
      this.comboValue = 0;
    } else {
      this.hitCount += 1;
      this.comboValue += 1;
      this.maxComboValue = Math.max(this.maxComboValue, this.comboValue);
    }
    this.state = 'pause';
    this.pauseLeft = this.rule.gapMs;
    return grade;
  }

  private nextBeat(): void {
    if (this.beat + 1 >= this.rule.beats) {
      this.state = 'done';
      return;
    }
    this.beat += 1;
    this.elapsed = 0;
    this.resolved = false;
    this.state = 'travel';
  }
}
