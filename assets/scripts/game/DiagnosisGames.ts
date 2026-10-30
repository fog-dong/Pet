// STATUS: implemented, W4 诊断小游戏工厂（听诊/拍片/化验共用回调签名）
import type { Node } from 'cc';
import type { CaseConfigItem } from '../config/CaseConfig';
import type { AuscultationResult } from './AuscultationScore';
import type { DiagnosisKind } from './DiagnosisSequence';
import { Auscultation } from './Auscultation';
import { Xray } from './Xray';
import { Lab } from './Lab';

export interface Hintable {
  revealHint(): void;
}

export function spawnDiagnosis(
  root: Node,
  kind: DiagnosisKind,
  item: CaseConfigItem,
  onFinish: (result: AuscultationResult) => void,
): Hintable {
  if (kind === 'xray') {
    const game = root.addComponent(Xray);
    game.startWith(item, onFinish);
    return game;
  }
  if (kind === 'lab') {
    const game = root.addComponent(Lab);
    game.startWith(item, onFinish);
    return game;
  }
  const game = root.addComponent(Auscultation);
  game.startWith(item, onFinish);
  return game;
}
