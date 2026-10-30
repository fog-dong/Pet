// STATUS: implemented, W4 诊断页布局与文案（三种小游戏共用）
import { Label, Node } from 'cc';
import { addLabel, PALETTE } from '../ui/SceneUI';
import { leftEdgeX } from '../ui/ScreenMetrics';
import type { DiagnosisKind } from './DiagnosisSequence';

export const DIAGNOSIS_NAME: Record<DiagnosisKind, string> = {
  auscultation: '听诊',
  xray: '拍片',
  lab: '化验',
};

export const DIAGNOSIS_HINT: Record<DiagnosisKind, string> = {
  auscultation: '点击宠物身上的区域，找出异常心音',
  xray: '拖动标记框，对准片子上的病灶',
  lab: '拖动左侧样本，连到右侧正确的试剂',
};

export interface DiagnosisLayout {
  hint: Label;
  step: Label;
}

export function buildDiagnosisLayout(root: Node, petName: string, breed: string): DiagnosisLayout {
  addLabel(root, 'PageTitle', '诊 断', 330, { size: 40 });
  addLabel(root, 'PetName', `${petName} · ${breed}`, 288, {
    size: 24, color: PALETTE.sub,
  });
  const step = addLabel(root, 'DiagnosisStep', '', 288, {
    size: 24, color: PALETTE.primary, width: 300, x: leftEdgeX(150),
  });
  const hint = addLabel(root, 'Hint', '', -262, {
    size: 24, color: PALETTE.sub, width: 900,
  });
  return { hint, step };
}
