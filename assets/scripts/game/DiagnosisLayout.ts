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
  xray: '拖动放大镜，盖住片子上的红色病灶',
  lab: '拖动左侧样本，连到右侧正确的试剂',
};

export interface DiagnosisLayout {
  hint: Label;
  step: Label;
}

/** 顶部三行各占一条独立水线，标题不再与小游戏计时/步骤挤在同一行。 */
export const DIAGNOSIS_TITLE_Y = 450;
export const DIAGNOSIS_PET_Y = 392;
export const DIAGNOSIS_HUD_Y = 344;
/** 提示行在小游戏棋盘（-230）之下、额外检查按钮（-350）之上。 */
export const DIAGNOSIS_HINT_Y = -282;

export function buildDiagnosisLayout(root: Node, petName: string, breed: string): DiagnosisLayout {
  addLabel(root, 'PageTitle', '诊 断', DIAGNOSIS_TITLE_Y, { size: 40 });
  addLabel(root, 'PetName', `${petName} · ${breed}`, DIAGNOSIS_PET_Y, {
    size: 24, color: PALETTE.sub, width: 400,
  });
  const step = addLabel(root, 'DiagnosisStep', '', DIAGNOSIS_HUD_Y, {
    size: 24, color: PALETTE.primary, width: 300, x: leftEdgeX(150),
  });
  const hint = addLabel(root, 'Hint', '', DIAGNOSIS_HINT_Y, {
    size: 24, color: PALETTE.sub, width: 620,
  });
  return { hint, step };
}
