// STATUS: implemented, W3 领养页（占位：无条件领养，写入本地图鉴）
import { _decorator, Component } from 'cc';
import { CaseSession } from './CaseSession';
import { Save } from '../cache/Save';
import { GameState } from '../core/GameFSM';
import { goState } from '../core/SceneFlow';
import { Track } from '../track/Track';
import { addButton, addLabel, PALETTE } from '../ui/SceneUI';

const { ccclass } = _decorator;

@ccclass('Adoption')
export class Adoption extends Component {
  private decided = false;

  protected start(): void {
    const item = CaseSession.current;
    if (!item) {
      void goState(GameState.Lobby, 'Lobby');
      return;
    }
    const root = this.node;
    addLabel(root, 'PageTitle', '领 养', 280, { size: 46 });
    addLabel(root, 'PetName', `${item.petName} 抬头看着你。`, 180, { size: 34 });
    addLabel(root, 'Hint', '领养后该病例会进入图鉴，也可以稍后再来。', 100, {
      size: 24,
      color: PALETTE.sub,
      width: 900,
    });
    addButton(root, 'AdoptButton', '领养它', -110, () => this.decide(true));
    addButton(root, 'LaterButton', '稍后再说', -220, () => this.decide(false), PALETTE.secondary);
  }

  private decide(adopt: boolean): void {
    if (this.decided) {
      return;
    }
    this.decided = true;
    const item = CaseSession.current;
    if (adopt && item) {
      CaseSession.adopted = true;
      Save.markAdopted(item.caseId);
      Track.track('adoption_complete', { caseId: item.caseId, petName: item.petName });
    }
    void goState(GameState.Result, 'Result');
  }
}
