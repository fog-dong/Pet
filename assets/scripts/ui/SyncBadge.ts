// STATUS: implemented, W13-2 大厅「结算待同步」提示（配置晚发布时金币延迟到账可见化，后台自动重试）
import type { Label, Node } from 'cc';
import { countPendingCases } from '../cache/PendingSync';
import { flushPending } from '../net/SyncCaseResult';
import { addLabel, PALETTE } from './SceneUI';
import { Track } from '../track/Track';

/** 只做展示与一次补发尝试：玩家不需要点，队列在启动、进厅、下局结算后自动重试。 */
export class SyncBadge {
  private label: Label | null = null;

  mount(parent: Node): void {
    this.label = addLabel(parent, 'SyncBadge', '', -352, { size: 20, color: PALETTE.sub, width: 680 });
    this.refresh();
  }

  refresh(): void {
    if (!this.label) {
      return;
    }
    const count = countPendingCases();
    this.label.string = count > 0 ? `有 ${count} 局结算待同步，稍后自动补发` : '';
  }

  async drain(): Promise<void> {
    const sent = await flushPending();
    if (sent > 0) {
      Track.track('lobby_pending_case_synced', { count: sent });
    }
    this.refresh();
  }
}
