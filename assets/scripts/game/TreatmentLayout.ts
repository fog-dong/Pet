// STATUS: implemented, W18 治疗页布局（左侧行头列 + 右侧三行等宽网格；药品多选、床位/时间单选）
import type { Label, Node } from 'cc';
import type { CaseConfigItem } from '../config/CaseConfig';
import { addButton, addLabel, PALETTE } from '../ui/SceneUI';
import { Choice, addChoiceRow, addRowHeader, paintChoices } from '../ui/ChoiceRow';
import { PlanStrip, addPlanStrip } from '../ui/PlanStrip';
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
  plan: PlanStrip;
  status: Label;
}

export interface TreatmentSelection {
  medicines: string[];
  bed: string;
  time: string;
}

const ROW_Y = [246, 140, 34];
const CELL_H = 84;
/** 左侧只剩行名竖条，网格从 -224 铺到屏幕右缘 -28，把宽度让给胶囊里的图标。 */
const GRID_LEFT = -224;
const GRID_GAP = 14;
const PLAN_Y = -80;
const NOTICE_Y = -166;
const CONFIRM_Y = -240;

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
  /** 升档后的危急度：门槛按它判，副标题也必须按它写，否则页面说 2/3、实际要 3/3。 */
  severity: string = item.severity,
): TreatmentLayout {
  addLabel(root, 'PageTitle', '治 疗', 500, { size: 42 });
  addLabel(root, 'PetName', `${item.petName} · ${item.breed}`, 458, {
    size: 26,
    color: PALETTE.sub,
  });
  // 05 §3：把危急度的治疗门槛写在页面上，不让玩家靠猜。
  const severityHint =
    severity === 'critical' ? '危重 · 药/床/时间必须全对（3/3）' : severity === 'urgent' ? '紧急 · 至少选对 2/3' : '普通 · 至少选对 2/3';
  addLabel(root, 'SeverityLabel', severityHint, 420, { size: 21, color: PALETTE.primary });
  addLabel(root, 'StockLabel', '药品可多选，再点一次取消；床位不足可改门诊或免费腾床', 384, {
    size: 21,
    color: PALETTE.sub,
  });

  const grid = buildGrid(
    Math.max(item.treatment.medicine.length, item.treatment.bed.length, item.treatment.time.length),
  );
  const headerX = -screenWidth() / 2 + 72;
  addRowHeader(root, '药品', ROW_Y[0], headerX);
  addRowHeader(root, '床位', ROW_Y[1], headerX);
  addRowHeader(root, '时间', ROW_Y[2], headerX);

  const medicines = addChoiceRow(root, 'Medicine', item.treatment.medicine, {
    y: ROW_Y[0],
    x0: grid.xFor(item.treatment.medicine.length, 0),
    gap: grid.width + GRID_GAP,
    width: grid.width,
    height: grid.height,
    icon: 'medicine',
    onClick: handlers.onMedicine,
  });
  const beds = addChoiceRow(root, 'Bed', item.treatment.bed, {
    y: ROW_Y[1],
    x0: grid.xFor(item.treatment.bed.length, 0),
    gap: grid.width + GRID_GAP,
    width: grid.width,
    height: grid.height,
    icon: 'bed',
    onClick: handlers.onBed,
  });
  const times = addChoiceRow(root, 'Time', item.treatment.time, {
    y: ROW_Y[2],
    x0: grid.xFor(item.treatment.time.length, 0),
    gap: grid.width + GRID_GAP,
    width: grid.width,
    height: grid.height,
    icon: 'time',
    onClick: handlers.onTime,
  });
  // 方案不再挤成一行小字：带阴影纸卡条把「药品 - 床位 - 时间」三格摆出来，失误提示另起一行。
  const plan = addPlanStrip(root, PLAN_Y, 660);
  const status = addLabel(root, 'Status', '', NOTICE_Y, {
    size: 22,
    color: PALETTE.sub,
    width: 660,
  });
  addButton(root, 'ConfirmButton', '开始治疗', CONFIRM_Y, handlers.onConfirm, PALETTE.primary, 460, 88);
  return { medicines, beds, times, plan, status };
}

/** 按当前选择重绘三组按钮与方案纸卡（药品支持多选，床位/时间单选）。 */
export function renderTreatment(layout: TreatmentLayout, selected: TreatmentSelection): void {
  paintChoices(layout.medicines, selected.medicines, (value) => `${value} ×${Hospital.medicineCount(value)}`);
  paintChoices(layout.beds, selected.bed ? [selected.bed] : []);
  paintChoices(layout.times, selected.time ? [selected.time] : []);
  layout.plan.setPlan(selected.medicines, selected.bed, selected.time, `床位 ${Hospital.bedsOccupied}/${Hospital.bedsOwned}`);
}
