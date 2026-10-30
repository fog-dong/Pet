// STATUS: implemented, W16 P1 大厅次级入口分派（图鉴 / 排行榜 / 隐私 / 关于）
import type { Node } from 'cc';
import { PrivacyState } from '../cache/PrivacyState';
import { CharacterConfig } from '../config/CharacterConfig';
import { COPY } from '../config/CopyText';
import { Track } from '../track/Track';
import { openAboutPanel } from './AboutPanel';
import { Codex } from './CodexPanel';
import type { LeaderboardPanel } from './LeaderboardPanel';
import { openPrivacyEntry } from './PrivacyDialog';
import type { SyncBadge } from './SyncBadge';

const MENU_TRACK: Record<string, string> = {
  CodexButton: 'lobby_codex_click',
  LeaderboardButton: 'lobby_leaderboard_click',
  PrivacyButton: 'lobby_privacy_click',
  AboutButton: 'lobby_about_click',
};

export interface LobbyMenuHost {
  node: Node;
  isValid: boolean;
  leaderboard: LeaderboardPanel;
  syncBadge: SyncBadge;
  showHint(text: string): void;
}

export function openLobbyMenu(name: string, host: LobbyMenuHost): void {
  Track.track(MENU_TRACK[name] ?? 'lobby_menu_click');
  if (name === 'CodexButton') {
    void CharacterConfig.load().then(() => {
      if (host.isValid && CharacterConfig.ready) {
        Codex.open(host.node);
      }
    });
    return;
  }
  if (name === 'LeaderboardButton') {
    if (PrivacyState.isGuest()) {
      host.showHint(COPY.lobbyGuestCodex);
      return;
    }
    host.leaderboard.open(host.node);
    return;
  }
  // 常驻入口：同意过只读正文；游客在此补同意，登录成功后当场补发本地结算。
  if (name === 'PrivacyButton') {
    openPrivacyEntry(host.node, (cloud) => {
      host.syncBadge.finishUpgrade(host.node, cloud, (text) => host.showHint(text));
    });
    return;
  }
  openAboutPanel(host.node);
}
