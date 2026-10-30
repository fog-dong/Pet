// STATUS: implemented, W3 病例介绍页
import { _decorator, Component, director } from 'cc';
import { CaseConfig } from '../config/CaseConfig';
import { CharacterConfig } from '../config/CharacterConfig';
import { CaseSession } from './CaseSession';
import { CharacterView } from './CharacterView';
import { GameState } from '../core/GameFSM';
import { goState } from '../core/SceneFlow';
import { addButton, addLabel, PALETTE } from '../ui/SceneUI';

const { ccclass } = _decorator;

const SEVERITY_TEXT: Record<string, string> = {
  normal: '普通',
  urgent: '紧急',
  critical: '危重',
};

@ccclass('CaseIntro')
export class CaseIntro extends Component {
  protected start(): void {
    const item = CaseSession.current;
    if (!item) {
      void goState(GameState.Lobby, 'Lobby');
      return;
    }

    const root = this.node;
    addLabel(root, 'PageTitle', '接 诊', 280, { size: 46 });
    addLabel(root, 'PetName', `${item.petName}（${item.breed}）`, 190, { size: 38 });
    addLabel(root, 'Severity', `分诊等级：${SEVERITY_TEXT[item.severity] ?? item.severity}`, 136, {
      size: 24,
      color: PALETTE.sub,
    });
    addLabel(root, 'Story', item.story, 50, { size: 26, width: 620, x: -160 });
    addLabel(root, 'Symptoms', `症状：${item.symptoms.join(' · ')}`, -20, {
      size: 24,
      color: PALETTE.sub,
      width: 620,
      x: -160,
    });
    addButton(root, 'AcceptButton', '开始诊断', -120, () => {
      void goState(GameState.Diagnosis, 'Diagnosis');
    });
    addButton(
      root,
      'SwapButton',
      '换一例',
      -205,
      () => {
        const next = CaseConfig.random(item.caseId);
        if (!next) {
          return;
        }
        CaseSession.start(next);
        director.loadScene('CaseIntro');
      },
      PALETTE.secondary,
    );
    addButton(
      root,
      'BackButton',
      '返回大厅',
      -290,
      () => {
        void goState(GameState.Lobby, 'Lobby');
      },
      PALETTE.secondary,
    );
    this.mountPet(item.petId);
  }

  private mountPet(petId: string): void {
    void CharacterConfig.load().then(() => {
      if (!this.isValid) {
        return;
      }
      CharacterView.mount(this.node, 470, 80).showPet(petId, 'sick');
    });
  }
}
