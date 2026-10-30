// STATUS: implemented, W3 治疗页（药品/床位/时间分配，兜底交给 TreatmentFallback）
import { _decorator, Component } from 'cc';
import type { CaseConfigItem } from '../config/CaseConfig';
import { CaseSession } from './CaseSession';
import { Hospital } from './Hospital';
import { judgeTreatment } from './CaseScore';
import { TreatmentFallback } from './TreatmentFallback';
import { TreatmentLayout, buildTreatmentLayout, renderTreatment } from './TreatmentLayout';
import { GameState } from '../core/GameFSM';
import { goState } from '../core/SceneFlow';
import { Track } from '../track/Track';
import { ChoicePanel } from '../ui/ChoicePanel';

const { ccclass } = _decorator;

@ccclass('Treatment')
export class Treatment extends Component {
  private item: CaseConfigItem | null = null;
  private layout: TreatmentLayout | null = null;
  private selectedMedicine = '';
  private selectedBed = '';
  private selectedTime = '';
  private readonly panel = new ChoicePanel();
  private readonly fallback = new TreatmentFallback(
    {
      root: () => this.node,
      requiredMedicine: () => (this.item ? this.item.treatment.correct.medicine : ''),
      onMedicineReady: (name) => this.selectMedicine(name),
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
      onMedicine: (value) => this.selectMedicine(value),
      onBed: (value) => this.selectBed(value),
      onTime: (value) => {
        this.selectedTime = value;
        this.render();
      },
      onConfirm: () => this.confirm(),
    });
    this.render();
  }

  protected onDestroy(): void {
    this.panel.close();
  }

  private selectMedicine(value: string): void {
    if (Hospital.medicineCount(value) <= 0) {
      this.selectedMedicine = '';
      this.render();
      this.fallback.medicineShortage(value, false);
      return;
    }
    this.selectedMedicine = value;
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
        medicine: this.selectedMedicine,
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
    if (!this.selectedMedicine || !this.selectedBed || !this.selectedTime) {
      this.status('请先把药品、床位、时间都选好');
      return;
    }
    if (this.selectedBed === '住院' && !Hospital.bedFree) {
      this.fallback.bedShortage();
      return;
    }
    if (!Hospital.useMedicine(this.selectedMedicine)) {
      this.selectedMedicine = '';
      this.render();
      this.fallback.medicineShortage(item.treatment.correct.medicine, false);
      return;
    }
    if (this.selectedBed === '住院' && !Hospital.admitBed()) {
      Hospital.addMedicine(this.selectedMedicine, 1);
      this.fallback.bedShortage();
      return;
    }
    const score = judgeTreatment(
      { medicine: this.selectedMedicine, bed: this.selectedBed, time: this.selectedTime },
      item.treatment.correct,
    );
    Track.track('treatment_allocate', {
      caseId: item.caseId,
      medicine: this.selectedMedicine,
      bed: this.selectedBed,
      time: this.selectedTime,
      result: score,
    });
    CaseSession.finishTreatment(this.selectedMedicine, this.selectedBed, this.selectedTime, score);
    this.render();
    if (score >= 2) {
      this.panel.close();
      void goState(GameState.Recovery, 'Recovery');
      return;
    }
    if (this.selectedBed === '住院') {
      Hospital.freeBed();
    }
    this.selectedMedicine = '';
    this.fallback.failure(score, item.treatment.correct.medicine);
  }

  private status(text: string): void {
    if (this.layout) {
      this.layout.status.string = text;
    }
  }
}
