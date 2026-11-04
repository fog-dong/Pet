// STATUS: implemented, W25 P2-A 负反馈结算（诊断失误扣好感 / 错药扣心情+好感+康复翻倍）
import { clampStat } from '../cache/HabitatCodec';
import { Save } from '../cache/Save';
import { PenaltyConfig } from '../config/PenaltyConfig';
import { Track } from '../track/Track';
import { Hospital } from './Hospital';

/**
 * 本局负反馈的瞬时状态：提示文本跨页只发一次，康复拉长倍数由错药写入。
 * 放在惩罚模块而不是会话里，是为了让会话文件不再变长；开局与放弃时由 CaseSession 统一 reset。
 */
export const CasePressure = {
  notice: '',
  recoveryMultiplier: 1,
  medicinePunished: false,

  reset(): void {
    this.notice = '';
    this.recoveryMultiplier = 1;
    this.medicinePunished = false;
  },

  takeNotice(): string {
    const text = this.notice;
    this.notice = '';
    return text;
  },
};

export type PenaltyLevel = 'none' | 'warn' | 'harsh';

export interface DiagnosisPenalty {
  level: PenaltyLevel;
  affection: number;
  /** harsh 档表示「病情恶化」，由 P2-A2 的危重倒计时接管。 */
  escalate: boolean;
  /** 给玩家看的短提示，Treatment 页进入时用 Toast 呈现。 */
  text: string;
}

/** 失误分两档：刚过警戒线只扣基础好感，连续失误按重罚并标记恶化（数值全在 penalty.json）。 */
export function diagnosisPenalty(mistakes: number): DiagnosisPenalty {
  const rules = PenaltyConfig.diagnosis;
  if (mistakes >= rules.escalateMistakes) {
    return {
      level: 'harsh',
      affection: rules.harshAffectionPenalty,
      escalate: true,
      text: `连续失误 ${mistakes} 次，病情恶化，好感度 −${rules.harshAffectionPenalty}`,
    };
  }
  if (mistakes >= rules.warnMistakes) {
    return {
      level: 'warn',
      affection: rules.affectionPenalty,
      escalate: false,
      text: `诊断失误 ${mistakes} 次，宠物受了不少折腾，好感度 −${rules.affectionPenalty}`,
    };
  }
  return { level: 'none', affection: 0, escalate: false, text: '' };
}

/**
 * 首诊宠物只扣好感度（Q2 拍板）；心情只作用于已领养、已在小屋落档的个体。
 * 落账同时把提示写进压力状态，由下一页的 Toast 公示（旧页下一帧就销毁）。
 */
export function penalizeDiagnosis(petId: string, mistakes: number): DiagnosisPenalty {
  const penalty = diagnosisPenalty(mistakes);
  if (!petId || penalty.level === 'none') {
    return penalty;
  }
  Hospital.addAffection(petId, -penalty.affection);
  CasePressure.notice = penalty.text;
  Track.track('case_penalty', {
    petId,
    stage: 'diagnosis',
    level: penalty.level,
    mistakes,
    affection: -penalty.affection,
  });
  return penalty;
}

/**
 * 药不对症是本模块最重的惩罚：掉大量心情、扣好感，并把康复时长按倍数拉长。
 * 多选也算错药，口径与 CaseScore.medicineMatches（恰好只选对症药才拿药分）一致。
 */
function applyMedicinePenalty(petId: string): { text: string; recoveryMultiplier: number } {
  const rules = PenaltyConfig.treatment;
  Hospital.addAffection(petId, -rules.wrongMedicineAffectionPenalty);
  const moodDropped = reduceMood(petId, rules.wrongMedicineMoodPenalty);
  Track.track('case_penalty', {
    petId,
    stage: 'treatment',
    level: 'wrong_medicine',
    affection: -rules.wrongMedicineAffectionPenalty,
    mood: moodDropped ? -rules.wrongMedicineMoodPenalty : 0,
    recoveryMultiplier: rules.recoveryTimeMultiplier,
  });
  const mood = moodDropped ? `、心情 −${rules.wrongMedicineMoodPenalty}` : '';
  return {
    text: `药不对症${mood}，好感度 −${rules.wrongMedicineAffectionPenalty}，康复时间 ×${rules.recoveryTimeMultiplier}`,
    recoveryMultiplier: rules.recoveryTimeMultiplier,
  };
}

/** 错药重罚一局只结算一次，连点重试不会把心情扣穿；返回给玩家看的提示（已罚过则空串）。 */
export function punishWrongMedicine(petId: string): string {
  if (CasePressure.medicinePunished) {
    return '';
  }
  CasePressure.medicinePunished = true;
  const penalty = applyMedicinePenalty(petId);
  CasePressure.recoveryMultiplier = Math.max(1, penalty.recoveryMultiplier);
  return penalty.text;
}

function reduceMood(petId: string, amount: number): boolean {
  if (amount <= 0) {
    return false;
  }
  let applied = false;
  Save.mutate((data) => {
    const entry = data.habitat.find((item) => item.petId === petId);
    if (!entry) {
      return;
    }
    entry.mood = clampStat(entry.mood - amount);
    applied = true;
  });
  return applied;
}
