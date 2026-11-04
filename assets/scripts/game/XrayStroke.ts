// STATUS: implemented, W25 P2-A 拍片笔迹判定：一笔没靠近病灶才算一次误判
import type { CaseConfigItem } from '../config/CaseConfig';
import { Track } from '../track/Track';

/**
 * 落指到抬手算「一笔」。整笔都没靠近任何病灶才记一次误判，
 * 这样同一次探索性长擦不会被逐帧计数，玩家乱擦一片也只扣一次。
 */
export class XrayStroke {
  private live = false;
  private near = false;
  private count = 0;

  /** settled 表示本局已定局（完成或结算中），此时抬手不再补记误判。 */
  constructor(
    private readonly caseItem: () => CaseConfigItem | null,
    private readonly settled: () => boolean,
  ) {}

  get mistakes(): number {
    return this.count;
  }

  begin(): void {
    this.live = true;
    this.near = false;
  }

  /** 这一笔里靠近过病灶，整笔作废，不再算误判。 */
  markNear(): void {
    this.near = true;
  }

  /** 抬手结算；返回本笔是否新增一次误判，调用方据此决定要不要提示。 */
  end(): boolean {
    if (!this.live) {
      return false;
    }
    this.live = false;
    if (this.near || this.settled()) {
      return false;
    }
    this.count += 1;
    const item = this.caseItem();
    Track.track('diagnosis_action', {
      caseId: item ? item.caseId : '',
      type: 'xray',
      result: 'miss',
      mistakes: this.count,
    });
    return true;
  }
}
