// STATUS: implemented, W3 结算页（星级 + 奖励 + 下一例）
import { _decorator, Component } from 'cc';
import { CaseConfig } from '../config/CaseConfig';
import { CaseSession } from './CaseSession';
import { Save } from '../cache/Save';
import { GameState } from '../core/GameFSM';
import { goState } from '../core/SceneFlow';
import { addButton, addLabel, PALETTE } from '../ui/SceneUI';

const { ccclass } = _decorator;

function starText(stars: number): string {
  const full = '★'.repeat(Math.max(0, Math.min(3, stars)));
  return `${full}${'☆'.repeat(3 - Math.max(0, Math.min(3, stars)))}`;
}

@ccclass('Result')
export class Result extends Component {
  protected start(): void {
    const item = CaseSession.current;
    const reward = CaseSession.settle();

    const root = this.node;
    addLabel(root, 'PageTitle', '结 算', 280, { size: 46 });
    addLabel(root, 'Stars', starText(reward.stars), 200, { size: 60, color: PALETTE.primary });
    addLabel(
      root,
      'Summary',
      reward.stars > 0
        ? `${item ? item.petName : '本病例'} 治疗成功`
        : `${item ? item.petName : '本病例'} 本次未能治愈`,
      130,
      { size: 30 },
    );
    addLabel(root, 'Reward', `金币 +${reward.coins}　爱心 +${reward.hearts}`, 70, { size: 28 });
    addLabel(root, 'Total', `累计金币 ${Save.coins}　累计爱心 ${Save.hearts}`, 20, {
      size: 24,
      color: PALETTE.sub,
    });
    if (reward.firstClear) {
      addLabel(root, 'FirstClear', '首通奖励已发放（金币 ×1.5）', -20, {
        size: 22,
        color: PALETTE.primary,
      });
    }
    addButton(root, 'NextButton', '下一例', -140, () => {
      const next = CaseConfig.random(item ? item.caseId : undefined);
      if (!next) {
        void goState(GameState.Lobby, 'Lobby');
        return;
      }
      CaseSession.start(next);
      void goState(GameState.CaseIntro, 'CaseIntro');
    });
    addButton(
      root,
      'HomeButton',
      '回大厅',
      -250,
      () => {
        void goState(GameState.Lobby, 'Lobby');
      },
      PALETTE.secondary,
    );
  }
}
