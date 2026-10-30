// STATUS: implemented, W3 治疗页布局（运行时构建，返回可重绘的控件句柄）
import type { Label, Node } from 'cc';
import type { CaseConfigItem } from '../config/CaseConfig';
import { addButton, addLabel, PALETTE } from '../ui/SceneUI';
import { Choice, addChoiceRow, addRowHeader, paintChoices } from '../ui/ChoiceRow';
import { fitRow, leftEdgeX, screenWidth } from '../ui/ScreenMetrics';
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
  addLabel(root, 'PageTitle', '治 疗', 440, { size: 42 });
  addLabel(root, 'PetName', `${item.petName} · ${item.breed}`, 396, {
    size: 26,
    color: PALETTE.sub,
  });
  // 05 §3：把危急度的治疗门槛写在页面上，不让玩家靠猜。
  const severityHint =
    item.severity === 'critical' ? '危重 · 药/床/时间必须全对（3/3）' : item.severity === 'urgent' ? '紧急 · 至少选对 2/3' : '普通 · 至少选对 2/3';
  addLabel(root, 'SeverityLabel', severityHint, 356, { size: 21, color: PALETTE.primary });
  addLabel(root, 'StockLabel', '药品看按钮角标；床位不足可改门诊或免费腾床', 316, {
    size: 21,
    color: PALETTE.sub,
  });
  // 竖屏：左侧留一列行名（96 宽），右侧 560 宽的区间均分给三组选项，行与行共用同一列宽。
  const rowRight = screenWidth() / 2 - 32;
  const slot = fitRow(
    Math.max(item.treatment.medicine.length, item.treatment.bed.length, item.treatment.time.length),
    rowRight - 560,
    rowRight,
  );
  const rowLabelX = leftEdgeX(48);
  addRowHeader(root, '药品', 'medicine', 200, rowLabelX);
  addRowHeader(root, '床位', 'bed', 105, rowLabelX);
  addRowHeader(root, '时间', 'time', 10, rowLabelX);
  const medicines = addChoiceRow(root, 'Medicine', item.treatment.medicine, {
    y: 200,
    x0: slot.x0,
    gap: slot.step,
    width: slot.width,
    onClick: handlers.onMedicine,
  });
  const beds = addChoiceRow(root, 'Bed', item.treatment.bed, {
    y: 105,
    x0: slot.x0,
    gap: slot.step,
    width: slot.width,
    onClick: handlers.onBed,
  });
  const times = addChoiceRow(root, 'Time', item.treatment.time, {
    y: 10,
    x0: slot.x0,
    gap: slot.step,
    width: slot.width,
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
