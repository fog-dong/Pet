// STATUS: implemented, W3 治疗页（药品/床位/时间分配，兜底交给 TreatmentFallback）；W17-3 治疗成功播欢快叫声
import { _decorator, Component } from 'cc';
import type { CaseConfigItem } from '../config/CaseConfig';
import { CaseSession } from './CaseSession';
import { CaseCrisis } from './CaseCrisis';
import { Hospital } from './Hospital';
import { judgeTreatment, medicineMatches, treatmentThreshold } from './CaseScore';
import { CasePressure, punishWrongMedicine } from './CasePenalty';
import { refundMedicines, takeMedicines } from './TreatmentStock';
import { Sfx } from './Sfx';
import { TreatmentFallback } from './TreatmentFallback';
import { TreatmentLayout, buildTreatmentLayout, renderTreatment } from './TreatmentLayout';
import { GameState } from '../core/GameFSM';
import { goState } from '../core/SceneFlow';
import { Track } from '../track/Track';
import { mountBackButton } from '../ui/BackButton';
import { ChoicePanel } from '../ui/ChoicePanel';
import { CrisisHud } from '../ui/CrisisHud';
import { showNotice } from '../ui/Toast';

const { ccclass } = _decorator;

@ccclass('Treatment')
export class Treatment extends Component {
  private item: CaseConfigItem | null = null;
  private layout: TreatmentLayout | null = null;
  private selectedMedicines: string[] = [];
  private selectedBed = '';
  private selectedTime = '';
  private submitting = false;
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
    }, CaseCrisis.effectiveSeverity(item.severity));
    this.render();
    mountBackButton(this.node, () => this.abandon(), true);
    // 抢救红条只在治疗页倒数：危急判定在诊断收尾才落账，诊断页没有时间可倒数。
    this.node.addComponent(CrisisHud);
    // 诊断阶段的失误后果在这一页公示，玩家能在治疗前看到已经损失的好感度。
    showNotice(this.node, CasePressure.takeNotice());
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
    if (!item || this.submitting) {
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
    // goState 是异步翻页，旧页在下一帧才销毁，这期间连点会二次扣库存，故整段事务加锁。
    this.submitting = true;
    const shortage = takeMedicines(this.selectedMedicines);
    if (shortage) {
      this.submitting = false;
      this.fallback.medicineShortage(shortage, false);
      return;
    }
    if (this.selectedBed === '住院' && !Hospital.admitBed()) {
      refundMedicines(this.selectedMedicines);
      this.submitting = false;
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
    // 真正扣掉的药要记账：万一倒计时归零，转院按这串退一部分。
    CaseCrisis.consume(this.selectedMedicines);
    // 药不对症（含多选带错药）当场结算后果：掉心情 + 扣好感 + 康复时长翻倍；一局只罚一次。
    const wrongMedicine = !medicineMatches(this.selectedMedicines, item.treatment.correct.medicine);
    const penaltyText = wrongMedicine ? punishWrongMedicine(item.petId) : '';
    this.render();
    // 05 §3：危重病例必须 3/3 全对才进康复，普通/紧急 2/3 即可；病情恶化后按升档的危急度判。
    const threshold = treatmentThreshold(CaseCrisis.effectiveSeverity(item.severity));
    if (score >= threshold) {
      this.panel.close();
      Sfx.play('treatOk');
      // 治对了危机即解除，康复页不再倒数（避免「治完了干等一条红条」）。
      CaseCrisis.clear();
      CasePressure.notice = penaltyText;
      void goState(GameState.Recovery, 'Recovery');
      return;
    }
    if (this.selectedBed === '住院') {
      Hospital.freeBed();
    }
    this.submitting = false;
    this.selectedMedicines = [];
    this.render();
    this.fallback.failure(
      score,
      item.treatment.correct.medicine,
      threshold,
      CaseCrisis.addTreatmentRetry(item.caseId),
    );
    // 面板打开后再弹 Toast，才不会被遮罩压暗（ChoicePanel 打开时把自己提到最上层）。
    showNotice(this.node, penaltyText);
  }

  private status(text: string): void {
    if (this.layout) {
      this.layout.status.string = text;
    }
  }
}
