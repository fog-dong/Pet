// STATUS: implemented, W9-4 排行榜弹窗（分页 + 好友榜空壳 + 空状态；游客模式不发请求）
import { BlockInputEvents, Button, Color, Label, Node } from 'cc';
import { PrivacyState } from '../cache/PrivacyState';
import { Net } from '../net/Net';
import { fetchLeaderboard, LeaderboardPage, LeaderboardType } from '../net/Leaderboard';
import { addButton, addLabel, addRect, PALETTE, setButtonState } from './SceneUI';
import { renderLeaderboardRows } from './LeaderboardRows';

const PANEL_W = 900;
const PANEL_H = 620;
const PAGE_SIZE = 5;

export class LeaderboardPanel {
  private overlay: Node | null = null;
  private panel: Node | null = null;
  private rows: Node | null = null;
  private hint: Label | null = null;
  private prevButton: Button | null = null;
  private nextButton: Button | null = null;
  private type: LeaderboardType = 'weekly';
  private page = 1;
  private pages = 1;
  private loading = false;
  open(parent: Node): void {
    if (this.overlay) {
      return;
    }
    const overlay = addRect(parent, 'LeaderboardOverlay', 0, 1280, 720, new Color(0, 0, 0, 140));
    overlay.addComponent(BlockInputEvents);
    const panel = addRect(overlay, 'LeaderboardPanel', 0, PANEL_W, PANEL_H, PALETTE.panel);
    this.overlay = overlay;
    this.panel = panel;
    addLabel(panel, 'LeaderboardTitle', '排 行 榜', 250, { size: 36 });
    addButton(panel, 'LeaderboardWeekly', '本周榜', 186, () => void this.switchType('weekly'), PALETTE.accent, 220, 64, -130);
    addButton(panel, 'LeaderboardFriends', '好友榜', 186, () => void this.switchType('friends'), PALETTE.secondary, 220, 64, 130);
    this.hint = addLabel(panel, 'LeaderboardHint', '', -212, { size: 22, color: PALETTE.sub, width: 780 });
    this.prevButton = addButton(panel, 'LeaderboardPrev', '上一页', -262, () => void this.turn(-1), PALETTE.secondary, 190, 64, -280);
    addButton(panel, 'LeaderboardClose', '关闭', -262, () => this.close(), PALETTE.primary, 190, 64, 0);
    this.nextButton = addButton(panel, 'LeaderboardNext', '下一页', -262, () => void this.turn(1), PALETTE.secondary, 190, 64, 280);
    void this.load();
  }

  close(): void {
    this.overlay?.destroy();
    this.overlay = null;
    this.panel = null;
    this.rows = null;
    this.hint = null;
    this.prevButton = null;
    this.nextButton = null;
  }

  private switchType(type: LeaderboardType): void {
    if (this.loading || this.type === type) {
      return;
    }
    this.type = type;
    this.page = 1;
    void this.load();
  }

  private turn(delta: number): void {
    if (this.loading) {
      return;
    }
    const target = Math.min(this.pages, Math.max(1, this.page + delta));
    if (target === this.page) {
      return;
    }
    this.page = target;
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.renderRows(null, '加载中…');
    if (PrivacyState.isGuest()) {
      // 游客不发起任何云端请求，面板只说明原因。
      this.loading = false;
      this.renderRows(null, '游客模式下排行榜暂不可用');
      this.setHint('在「隐私与协议」中同意后可开启排行榜。');
      this.refreshNav();
      return;
    }
    if (!Net.ready) {
      this.loading = false;
      this.renderRows(null, '离线模式，排行榜暂不可用');
      this.setHint('');
      this.refreshNav();
      return;
    }
    const data = await fetchLeaderboard(this.type, this.page, PAGE_SIZE);
    this.loading = false;
    if (!this.overlay) {
      return;
    }
    if (!data) {
      this.renderRows(null, '排行榜加载失败，稍后再试');
      this.refreshNav();
      return;
    }
    this.pages = Math.max(1, Math.ceil(data.total / data.pageSize));
    this.renderRows(data, this.emptyText(data));
    this.setHint(this.footerText(data));
    this.refreshNav();
  }

  private emptyText(data: LeaderboardPage): string {
    if (this.type === 'friends') {
      return '好友榜需要关系链，暂未开放';
    }
    return data.total === 0 ? '暂无排行' : '本页暂无数据';
  }

  private footerText(data: LeaderboardPage): string {
    if (this.type === 'friends') {
      return '好友榜暂未开放，先看本周榜吧';
    }
    const mine = data.self ? `我的名次：第 ${data.self.rank} 名 · ${data.self.score} 分` : '我还没有上榜';
    return `第 ${data.page}/${this.pages} 页 · 共 ${data.total} 人　${mine}`;
  }

  private renderRows(data: LeaderboardPage | null, empty: string): void {
    if (!this.panel) {
      this.rows?.destroy();
      this.rows = null;
      return;
    }
    this.rows = renderLeaderboardRows(this.panel, this.rows, data, empty);
  }

  private refreshNav(): void {
    if (this.prevButton) {
      setButtonState(this.prevButton, this.page > 1, '上一页', PALETTE.secondary);
    }
    if (this.nextButton) {
      setButtonState(this.nextButton, this.page < this.pages, '下一页', PALETTE.secondary);
    }
  }

  private setHint(text: string): void {
    if (this.hint) {
      this.hint.string = text;
    }
  }
}
