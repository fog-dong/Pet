// STATUS: implemented, W14-2 大厅「结算待同步」提示（升级当场补发并刷新；配置晚发布时金币延迟到账可见化）
import { Color, Label, Node } from 'cc';
import { countPendingCases } from '../cache/PendingSync';
import {
  PRIVACY_SYNCING_TEXT,
  PRIVACY_UPGRADED_OFFLINE_TEXT,
  PRIVACY_UPGRADED_TEXT,
} from '../config/LegalConfig';
import type { CloudSyncStart } from '../core/BootCloud';
import { flushPending } from '../net/SyncCaseResult';
import { pendingBadgeText } from '../net/SyncPolicy';
import { makeLabel } from './FontKit';
import { addPill } from './PanelKit';
import { COLORS } from './Tokens';
import { Track } from '../track/Track';

/** 只做展示与补发尝试：玩家不需要点，队列在启动、进厅、下局结算、游客升级后自动重试。 */
export class SyncBadge {
  private label: Label | null = null;
  private pill: Node | null = null;

  mount(parent: Node): void {
    this.pill = addPill(parent, 'SyncBadge', -400, 620, 56, new Color(62, 50, 42, 190));
    this.label = makeLabel(this.pill, 'SyncBadgeLabel', '', 0, {
      size: 22,
      width: 580,
      color: COLORS.white,
    });
    this.refresh();
  }

  refresh(): void {
    if (!this.label || !this.pill) {
      return;
    }
    const text = pendingBadgeText(countPendingCases());
    this.pill.active = text.length > 0;
    this.label.string = text;
  }

  async drain(): Promise<void> {
    const sent = await flushPending();
    if (sent > 0) {
      Track.track('lobby_pending_case_synced', { count: sent });
    }
    this.refresh();
  }

  /**
   * 游客当场升级：先给过场文案，等 login + 补发结束后刷新角标，再落到最终提示。
   * login 失败时保留 pending，玩家下次启动/进厅仍会重试。
   */
  finishUpgrade(parent: Node, cloud: CloudSyncStart, onHint: (text: string) => void): void {
    if (!this.label) {
      this.mount(parent);
    }
    onHint(PRIVACY_SYNCING_TEXT);
    const settle = (ready: boolean): void => {
      this.refresh();
      onHint(ready ? PRIVACY_UPGRADED_TEXT : PRIVACY_UPGRADED_OFFLINE_TEXT);
    };
    void cloud.done.then(settle, () => settle(false));
  }
}
