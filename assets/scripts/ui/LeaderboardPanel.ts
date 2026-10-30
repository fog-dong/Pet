// STATUS: implemented, W9-4 排行榜弹窗（分页 + 好友榜空壳；游客模式不发请求，骨架见 LeaderboardKit）
import { Button, Label, Node, UITransform } from 'cc';
import { PrivacyState } from '../cache/PrivacyState';
import { Net } from '../net/Net';
import { fetchLeaderboard, LeaderboardPage, LeaderboardType } from '../net/Leaderboard';
import { PALETTE, setButtonState } from './SceneUI';
import { renderLeaderboardRows } from './LeaderboardRows';
import { buildLeaderboardChrome } from './LeaderboardKit';
import { fitWidth } from './ScreenMetrics';

const PAGE_SIZE = 8;
const ROW_H = 56;

export class LeaderboardPanel {
  private overlay: Node | null = null;
  private rowHost: Node | null = null;
  private rows: Node | null = null;
  private hint: Label | null = null;
  private prevButton: Button | null = null;
  private nextButton: Button | null = null;
  private panelW = fitWidth(900, 30);
  private type: LeaderboardType = 'weekly';
  private page = 1;
  private pages = 1;
  private loading = false;

  open(parent: Node): void {
    if (this.overlay) {
      return;
    }
    const chrome = buildLeaderboardChrome(parent, {
      onType: (type) => void this.switchType(type),
      onTurn: (delta) => this.turn(delta),
      onClose: () => this.close(),
    });
    this.overlay = chrome.overlay;
    this.rowHost = chrome.rowHost;
    this.hint = chrome.hint;
    this.prevButton = chrome.prev;
    this.nextButton = chrome.next;
    void this.load();
  }

  close(): void {
    this.overlay?.destroy();
    this.overlay = null;
    this.rowHost = null;
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
      this.finish(null, '游客模式下排行榜暂不可用', '在「隐私与协议」中同意后可开启排行榜。');
      return;
    }
    if (!Net.ready) {
      this.finish(null, '离线模式，排行榜暂不可用', '');
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

  private finish(data: null, empty: string, hint: string): void {
    this.loading = false;
    this.renderRows(data, empty);
    this.setHint(hint);
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
    if (!this.rowHost) {
      this.rows?.destroy();
      this.rows = null;
      return;
    }
    this.rows = renderLeaderboardRows(this.rowHost, this.rows, data, empty, this.panelW, ROW_H);
    // 内容高度按行数撑开，行数超过可视区才能真的滚动。
    const transform = this.rowHost.getComponent(UITransform);
    transform?.setContentSize(transform.contentSize.width, Math.max(180, (data?.entries.length ?? 1) * ROW_H));
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
