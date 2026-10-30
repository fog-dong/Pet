// STATUS: implemented, W3 治疗页布局（运行时构建，返回可重绘的控件句柄）
import type { Label, Node } from 'cc';
import type { CaseConfigItem } from '../config/CaseConfig';
import { addButton, addLabel, PALETTE } from '../ui/SceneUI';
import { Choice, addChoiceRow, paintChoices } from '../ui/ChoiceRow';
import { Hospital } from './Hospital';

export interface TreatmentHandlers {
  onMedicine: (value: string) => void;
  onBed: (value: string) => void;
  onTime: (value: string) => void;
  onConfirm: () => void;
}

export interface TreatmentLayout {
  medicines: Choice[];
  beds: Choice[];
  times: Choice[];
  status: Label;
}

export interface TreatmentSelection {
  medicine: string;
  bed: string;
  time: string;
}

export function buildTreatmentLayout(
  root: Node,
  item: CaseConfigItem,
  handlers: TreatmentHandlers,
): TreatmentLayout {
  addLabel(root, 'PageTitle', '治 疗', 330, { size: 42 });
  addLabel(root, 'PetName', `${item.petName} · ${item.breed}`, 292, {
    size: 26,
    color: PALETTE.sub,
  });
  addLabel(root, 'StockLabel', '药品看按钮角标；床位不足可改门诊或免费腾床', 252, {
    size: 21,
    color: PALETTE.sub,
  });
  addLabel(root, 'MedicineLabel', '药品', 185, { size: 22, color: PALETTE.sub, x: -560, width: 100 });
  addLabel(root, 'BedLabel', '床位', 95, { size: 22, color: PALETTE.sub, x: -560, width: 100 });
  addLabel(root, 'TimeLabel', '时间', 5, { size: 22, color: PALETTE.sub, x: -560, width: 100 });
  const medicines = addChoiceRow(root, 'Medicine', item.treatment.medicine, {
    y: 185,
    x0: -340,
    gap: 340,
    onClick: handlers.onMedicine,
  });
  const beds = addChoiceRow(root, 'Bed', item.treatment.bed, {
    y: 95,
    x0: -170,
    gap: 340,
    onClick: handlers.onBed,
  });
  const times = addChoiceRow(root, 'Time', item.treatment.time, {
    y: 5,
    x0: -170,
    gap: 340,
    onClick: handlers.onTime,
  });
  const status = addLabel(root, 'Status', '', -90, {
    size: 24,
    color: PALETTE.sub,
    width: 1000,
  });
  addButton(root, 'ConfirmButton', '开始治疗', -195, handlers.onConfirm, PALETTE.primary, 420, 86);
  return { medicines, beds, times, status };
}

/** 按当前选择重绘三组按钮与状态行（含药品角标、床位占用）。 */
export function renderTreatment(layout: TreatmentLayout, selected: TreatmentSelection): void {
  paintChoices(layout.medicines, selected.medicine, (value) => `${value} ×${Hospital.medicineCount(value)}`);
  paintChoices(layout.beds, selected.bed);
  paintChoices(layout.times, selected.time);
  const plan = [
    selected.medicine || '未选药',
    selected.bed || '未选床位',
    selected.time || '未选时间',
  ];
  layout.status.string = `当前方案：${plan.join(' · ')}　床位 ${Hospital.bedsOccupied}/${Hospital.bedsOwned}`;
}
