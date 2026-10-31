// STATUS: implemented, W17-3 康复进度里程碑（每 25% 触发一次提示音，Recovery 页自身不再膨胀）
const MARKS = [0.25, 0.5, 0.75, 1];

export class RecoveryMilestones {
  private passed = 0;

  /** 广告加速会让进度一次跳过多个档位，同一次更新只响一声。 */
  update(ratio: number): boolean {
    let crossed = false;
    while (this.passed < MARKS.length && ratio >= MARKS[this.passed]) {
      this.passed += 1;
      crossed = true;
    }
    return crossed;
  }
}
