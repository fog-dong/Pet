// STATUS: implemented, W18-2 大厅次级入口分派（医院 / 小屋 / 图鉴 / 排行榜 / 隐私 / 关于）
import type { Node } from 'cc';
import { PrivacyState } from '../cache/PrivacyState';
import { CharacterConfig } from '../config/CharacterConfig';
import { COPY } from '../config/CopyText';
import { Track } from '../track/Track';
import { openAboutPanel } from './AboutPanel';
import { Codex } from './CodexPanel';
import { openHabitatPanel } from './HabitatPanel';
import { openHospitalPanel } from './HospitalPanel';
import type { LeaderboardPanel } from './LeaderboardPanel';
import { openPrivacyEntry } from './PrivacyDialog';
import type { SyncBadge } from './SyncBadge';

const MENU_TRACK: Record<string, string> = {
  HospitalButton: 'lobby_hospital_click',
  HabitatButton: 'lobby_habitat_click',
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
  refreshStats(): void;
}

/** focusPetId 只来自大厅散步带：直接滚到被点的那只，不从第一只重新找。 */
export function openLobbyMenu(name: string, host: LobbyMenuHost, focusPetId?: string): void {
  Track.track(MENU_TRACK[name] ?? 'lobby_menu_click');
  if (name === 'HospitalButton') {
    openHospitalPanel(host.node, () => host.refreshStats());
    return;
  }
  if (name === 'HabitatButton') {
    // 小屋要按 pets.json 的品种初始值补种缺失条目，先等角色表就绪再开面板。
    void CharacterConfig.load().then(() => {
      if (host.isValid) {
        openHabitatPanel(host.node, () => host.refreshStats(), focusPetId);
      }
    });
    return;
  }
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
