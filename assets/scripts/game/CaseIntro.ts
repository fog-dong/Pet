// STATUS: implemented, W9-5 病例介绍页（含医疗虚构免责固定句）
import { _decorator, Component, director } from 'cc';
import { CaseConfig } from '../config/CaseConfig';
import { CharacterConfig } from '../config/CharacterConfig';
import { MEDICAL_DISCLAIMER_TEXT } from '../config/LegalConfig';
import { CaseSession } from './CaseSession';
import { CharacterView } from './CharacterView';
import { GameState } from '../core/GameFSM';
import { goState } from '../core/SceneFlow';
import { addButton, addLabel, PALETTE } from '../ui/SceneUI';
import { leftEdgeX, rightEdgeX } from '../ui/ScreenMetrics';

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
    // 竖屏正文只能占左侧一列：右侧留给缩小的立绘，避免文字压在角色上。
    addLabel(root, 'Story', item.story, 50, { size: 26, width: 520, x: -80 });
    addLabel(root, 'Symptoms', `症状：${item.symptoms.join(' · ')}`, -20, {
      size: 24,
      color: PALETTE.sub,
      width: 520,
      x: -80,
    });
    // 医疗虚构免责固定句：每个病例都会经过这一屏，文案只在 LegalConfig 维护。
    addLabel(root, 'MedicalNotice', MEDICAL_DISCLAIMER_TEXT, -200, {
      size: 18,
      color: PALETTE.sub,
      width: 440,
      x: leftEdgeX(220),
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
      const view = CharacterView.mount(this.node, rightEdgeX(72), 80);
      view.node.setScale(0.6, 0.6, 1);
      view.showPet(petId, 'sick');
    });
  }
}
