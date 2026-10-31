// STATUS: implemented, W18 治疗页布局（左侧行头列 + 右侧三行等宽网格；药品多选、床位/时间单选）
import type { Label, Node } from 'cc';
import type { CaseConfigItem } from '../config/CaseConfig';
import { addButton, addLabel, PALETTE } from '../ui/SceneUI';
import { Choice, addChoiceRow, addRowHeader, paintChoices } from '../ui/ChoiceRow';
import { screenWidth } from '../ui/ScreenMetrics';
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
  medicines: string[];
  bed: string;
  time: string;
}

const ROW_Y = [246, 140, 34];
const CELL_H = 84;
/** 左侧行头列贴边，右侧网格从 -140 铺到屏幕右缘 -28。 */
const GRID_LEFT = -140;
const GRID_GAP = 14;

interface Grid {
  width: number;
  height: number;
  xFor: (count: number, index: number) => number;
}

/** 三行共用同一组列宽；选项少的行按格居中，不破坏跨行对齐。 */
function buildGrid(columns: number): Grid {
  const cols = Math.max(1, columns);
  const right = screenWidth() / 2 - 28;
  const width = Math.max(90, (right - GRID_LEFT - GRID_GAP * (cols - 1)) / cols);
  const step = width + GRID_GAP;
  return {
    width,
    height: CELL_H,
    xFor: (count, index) => GRID_LEFT + ((cols - count) * step) / 2 + width / 2 + index * step,
  };
}

export function buildTreatmentLayout(
  root: Node,
  item: CaseConfigItem,
  handlers: TreatmentHandlers,
): TreatmentLayout {
  addLabel(root, 'PageTitle', '治 疗', 500, { size: 42 });
  addLabel(root, 'PetName', `${item.petName} · ${item.breed}`, 458, {
    size: 26,
    color: PALETTE.sub,
  });
  // 05 §3：把危急度的治疗门槛写在页面上，不让玩家靠猜。
  const severityHint =
    item.severity === 'critical' ? '危重 · 药/床/时间必须全对（3/3）' : item.severity === 'urgent' ? '紧急 · 至少选对 2/3' : '普通 · 至少选对 2/3';
  addLabel(root, 'SeverityLabel', severityHint, 420, { size: 21, color: PALETTE.primary });
  addLabel(root, 'StockLabel', '药品可多选，再点一次取消；床位不足可改门诊或免费腾床', 384, {
    size: 21,
    color: PALETTE.sub,
  });

  const grid = buildGrid(
    Math.max(item.treatment.medicine.length, item.treatment.bed.length, item.treatment.time.length),
  );
  const headerX = -screenWidth() / 2 + 84;
  addRowHeader(root, '药品', 'medicine', ROW_Y[0], headerX);
  addRowHeader(root, '床位', 'bed', ROW_Y[1], headerX);
  addRowHeader(root, '时间', 'time', ROW_Y[2], headerX);

  const medicines = addChoiceRow(root, 'Medicine', item.treatment.medicine, {
    y: ROW_Y[0],
    x0: grid.xFor(item.treatment.medicine.length, 0),
    gap: grid.width + GRID_GAP,
    width: grid.width,
    height: grid.height,
    onClick: handlers.onMedicine,
  });
  const beds = addChoiceRow(root, 'Bed', item.treatment.bed, {
    y: ROW_Y[1],
    x0: grid.xFor(item.treatment.bed.length, 0),
    gap: grid.width + GRID_GAP,
    width: grid.width,
    height: grid.height,
    onClick: handlers.onBed,
  });
  const times = addChoiceRow(root, 'Time', item.treatment.time, {
    y: ROW_Y[2],
    x0: grid.xFor(item.treatment.time.length, 0),
    gap: grid.width + GRID_GAP,
    width: grid.width,
    height: grid.height,
    onClick: handlers.onTime,
  });
  const status = addLabel(root, 'Status', '', -46, {
    size: 23,
    color: PALETTE.sub,
    width: 660,
  });
  addButton(root, 'ConfirmButton', '开始治疗', -164, handlers.onConfirm, PALETTE.primary, 460, 88);
  return { medicines, beds, times, status };
}

/** 按当前选择重绘三组按钮与状态行（药品支持多选，床位/时间单选）。 */
export function renderTreatment(layout: TreatmentLayout, selected: TreatmentSelection): void {
  paintChoices(layout.medicines, selected.medicines, (value) => `${value} ×${Hospital.medicineCount(value)}`);
  paintChoices(layout.beds, selected.bed ? [selected.bed] : []);
  paintChoices(layout.times, selected.time ? [selected.time] : []);
  const plan = [
    selected.medicines.length > 0 ? selected.medicines.join(' + ') : '未选药',
    selected.bed || '未选床位',
    selected.time || '未选时间',
  ];
  layout.status.string = `当前方案：${plan.join(' · ')}　床位 ${Hospital.bedsOccupied}/${Hospital.bedsOwned}`;
}
