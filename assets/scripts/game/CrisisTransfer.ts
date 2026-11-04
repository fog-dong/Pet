// STATUS: implemented, W25 P2-A2 危重倒计时归零的转院终局（退药 + 扣爱心 + 释放床位 + 走失败结算）
import { Save } from '../cache/Save';
import { PenaltyConfig } from '../config/PenaltyConfig';
import { GameState } from '../core/GameFSM';
import { goState } from '../core/SceneFlow';
import { Track } from '../track/Track';
import { CaseCrisis } from './CaseCrisis';
import { CaseSession } from './CaseSession';
import { Reputation } from './Reputation';
import { refundUsedMedicines } from './TreatmentStock';

/**
 * 转院 = 本局失败：金币与爱心都不入账（settle() 在没有成功治疗记录时返回空奖励），
 * 只按比例退回本局已消耗的药品、扣一笔爱心与一次口碑差评，并把占用的住院床归还医院。
 */
export function runCrisisTransfer(): void {
  if (CaseCrisis.transferred) {
    return;
  }
  const rules = PenaltyConfig.crisis;
  const refunded = refundUsedMedicines(CaseCrisis.consumedMedicines, rules.refundRatio);
  Save.addHearts(-rules.heartsPenalty);
  const reputation = Reputation.punishTransfer();
  CaseSession.releaseBed();
  CaseCrisis.noteTransfer(refunded, rules.heartsPenalty, -reputation.delta);
  const item = CaseSession.current;
  Track.track('case_transfer', {
    caseId: item ? item.caseId : '',
    consumed: CaseCrisis.consumedMedicines.join('+'),
    refunded: refunded.join('+'),
    refundRatio: rules.refundRatio,
    hearts: -rules.heartsPenalty,
    reputation: reputation.delta,
  });
  void goState(GameState.Result, 'Result');
}
