// STATUS: implemented, W25 P1-A 大厅主按钮入口（街头寻访；新宠结果页确认后直接接诊）
import type { Node } from 'cc';
import { CaseConfig } from '../config/CaseConfig';
import { COPY } from '../config/CopyText';
import { GameState } from '../core/GameFSM';
import { goState } from '../core/SceneFlow';
import { CaseSession } from '../game/CaseSession';
import { Track } from '../track/Track';
import { openGachaPanel } from './GachaPanel';

export interface LobbyStartHost {
  showHint(text: string): void;
  refreshStats(): void;
}

export function openGachaFromLobby(node: Node, host: LobbyStartHost): void {
  Track.track('lobby_start_click');
  openGachaPanel(node, {
    refreshStats: () => host.refreshStats(),
    onIntake: (petId) => {
      const item = CaseConfig.byPet(petId);
      if (!item) {
        Track.track('lobby_cases_missing');
        host.showHint(COPY.lobbyNoCase);
        return;
      }
      CaseSession.start(item);
      void goState(GameState.CaseIntro, 'CaseIntro');
    },
  });
}
