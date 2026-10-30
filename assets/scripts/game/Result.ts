// STATUS: implemented, W3 结算页（总星 = 诊断 + 治疗 + 康复，下一例回大厅）
import { _decorator, Component } from 'cc';
import { CaseSession } from './CaseSession';
import { Save } from '../cache/Save';
import { GameState } from '../core/GameFSM';
import { goState } from '../core/SceneFlow';
import { addButton, addLabel, PALETTE } from '../ui/SceneUI';

const { ccclass } = _decorator;

function starText(stars: number): string {
  const clamped = Math.max(0, Math.min(3, stars));
  return `${'★'.repeat(clamped)}${'☆'.repeat(3 - clamped)}`;
}

@ccclass('Result')
export class Result extends Component {
  protected start(): void {
    const item = CaseSession.current;
    const reward = CaseSession.settle();
    const success = reward.stars > 0;
    const root = this.node;
    addLabel(root, 'PageTitle', '结 算', 300, { size: 46 });
    addLabel(root, 'Stars', starText(reward.stars), 210, {
      size: 60,
      color: PALETTE.primary,
    });
    addLabel(
      root,
      'Summary',
      `${item ? item.petName : '本病例'} ${success ? '治疗成功' : '本次未能治愈'}`,
      140,
      { size: 32 },
    );
    if (success) {
      addLabel(
        root,
        'Breakdown',
        `诊断 ${reward.diagnosisStars}★ · 治疗 ${reward.treatmentScore}/3 · 康复 ${reward.recoveryStars}★`,
        85,
        { size: 24, color: PALETTE.sub },
      );
    }
    addLabel(
      root,
      'Reward',
      `金币 +${reward.coins}　爱心 +${reward.hearts}　好感 +${reward.affection}`,
      30,
      { size: 26 },
    );
    addLabel(
      root,
      'Adopted',
      CaseSession.adopted ? '已领养，图鉴更新为「已救助」' : '本次未领养，可以稍后再来',
      -20,
      { size: 22, color: PALETTE.sub },
    );
    addLabel(
      root,
      'Total',
      `累计金币 ${Save.coins}　累计爱心 ${Save.hearts}　已治愈 ${Save.casesDone} 例`,
      -65,
      { size: 22, color: PALETTE.sub },
    );
    if (reward.firstClear) {
      addLabel(root, 'FirstClear', '首通奖励已发放（金币 ×1.5）', -105, {
        size: 22,
        color: PALETTE.primary,
      });
    }
    addButton(root, 'LobbyButton', '下一例', -230, () => {
      void goState(GameState.Lobby, 'Lobby');
    });
  }
}
