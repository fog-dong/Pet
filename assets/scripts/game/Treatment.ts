// STATUS: implemented, W3 治疗页（药品/床位/时间分配，兜底交给 TreatmentFallback）
import { _decorator, Component } from 'cc';
import type { CaseConfigItem } from '../config/CaseConfig';
import { CaseSession } from './CaseSession';
import { Hospital } from './Hospital';
import { judgeTreatment, treatmentThreshold } from './CaseScore';
import { TreatmentFallback } from './TreatmentFallback';
import { TreatmentLayout, buildTreatmentLayout, renderTreatment } from './TreatmentLayout';
import { GameState } from '../core/GameFSM';
import { goState } from '../core/SceneFlow';
import { Track } from '../track/Track';
import { mountBackButton } from '../ui/BackButton';
import { ChoicePanel } from '../ui/ChoicePanel';

const { ccclass } = _decorator;

@ccclass('Treatment')
export class Treatment extends Component {
  private item: CaseConfigItem | null = null;
  private layout: TreatmentLayout | null = null;
  private selectedMedicines: string[] = [];
  private selectedBed = '';
  private selectedTime = '';
  private readonly panel = new ChoicePanel();
  private readonly fallback = new TreatmentFallback(
    {
      root: () => this.node,
      requiredMedicine: () => (this.item ? this.item.treatment.correct.medicine : ''),
      onMedicineReady: (name) => this.addMedicine(name),
      onBedReady: () => this.selectBed('住院'),
      onOutpatient: () => this.selectBed('门诊'),
      status: (text) => this.status(text),
      schedule: (fn, seconds) => this.scheduleOnce(fn, seconds),
    },
    this.panel,
  );

  protected start(): void {
    const item = CaseSession.current;
    if (!item) {
      void goState(GameState.Lobby, 'Lobby');
      return;
    }
    this.item = item;
    this.layout = buildTreatmentLayout(this.node, item, {
      onMedicine: (value) => this.toggleMedicine(value),
      onBed: (value) => this.selectBed(value),
      onTime: (value) => {
        this.selectedTime = value;
        this.render();
      },
      onConfirm: () => this.confirm(),
    });
    this.render();
    mountBackButton(this.node, () => this.abandon(), true);
  }

  private abandon(): void {
    CaseSession.abort();
    void goState(GameState.Lobby, 'Lobby');
  }

  protected onDestroy(): void {
    this.panel.close();
  }

  /** 药品多选：再点一次取消；库存为 0 时不进入选中集合。 */
  private toggleMedicine(value: string): void {
    const index = this.selectedMedicines.indexOf(value);
    if (index >= 0) {
      this.selectedMedicines.splice(index, 1);
      this.render();
      return;
    }
    if (Hospital.medicineCount(value) <= 0) {
      this.fallback.medicineShortage(value, false);
      return;
    }
    this.selectedMedicines.push(value);
    this.render();
  }

  private addMedicine(value: string): void {
    if (value && !this.selectedMedicines.includes(value)) {
      this.selectedMedicines.push(value);
    }
    this.render();
  }

  private selectBed(value: string): void {
    if (value === '住院' && !Hospital.bedFree) {
      this.fallback.bedShortage();
      return;
    }
    this.selectedBed = value;
    this.render();
  }

  private render(): void {
    if (this.layout) {
      renderTreatment(this.layout, {
        medicines: this.selectedMedicines,
        bed: this.selectedBed,
        time: this.selectedTime,
      });
    }
  }

  private confirm(): void {
    const item = this.item;
    if (!item) {
      return;
    }
    if (this.selectedMedicines.length === 0 || !this.selectedBed || !this.selectedTime) {
      this.status('请至少选择一种药品，并把床位和时间都选好');
      return;
    }
    if (this.selectedBed === '住院' && !Hospital.bedFree) {
      this.fallback.bedShortage();
      return;
    }
    // 多选药品按事务扣库存：任何一味不足就全部退回，避免半扣。
    const used: string[] = [];
    for (const name of this.selectedMedicines) {
      if (!Hospital.useMedicine(name)) {
        for (const done of used) {
          Hospital.addMedicine(done, 1);
        }
        this.fallback.medicineShortage(name, false);
        return;
      }
      used.push(name);
    }
    if (this.selectedBed === '住院' && !Hospital.admitBed()) {
      for (const done of used) {
        Hospital.addMedicine(done, 1);
      }
      this.fallback.bedShortage();
      return;
    }
    const score = judgeTreatment(
      { medicines: this.selectedMedicines, bed: this.selectedBed, time: this.selectedTime },
      item.treatment.correct,
    );
    Track.track('treatment_allocate', {
      caseId: item.caseId,
      medicines: this.selectedMedicines.join('+'),
      medicineCount: this.selectedMedicines.length,
      bed: this.selectedBed,
      time: this.selectedTime,
      result: score,
    });
    CaseSession.finishTreatment([...this.selectedMedicines], this.selectedBed, this.selectedTime, score);
    this.render();
    // 05 §3：危重病例必须 3/3 全对才进康复，普通/紧急 2/3 即可。
    const threshold = treatmentThreshold(item.severity);
    if (score >= threshold) {
      this.panel.close();
      void goState(GameState.Recovery, 'Recovery');
      return;
    }
    if (this.selectedBed === '住院') {
      Hospital.freeBed();
    }
    this.selectedMedicines = [];
    this.render();
    this.fallback.failure(score, item.treatment.correct.medicine, threshold);
  }

  private status(text: string): void {
    if (this.layout) {
      this.layout.status.string = text;
    }
  }
}
