// STATUS: implemented, W4 病例配置（cases 分包加载 + 内置 2 例兜底）
import { loadConfigJson } from './ConfigLoader';
import { LOCAL_CASES } from './LocalCases';

export type Severity = 'normal' | 'urgent' | 'critical';
export type PetSpecies = 'cat' | 'dog';

export interface TreatmentCorrect {
  medicine: string;
  bed: string;
  time: string;
}

export interface CaseTreatmentConfig {
  medicine: string[];
  bed: string[];
  time: string[];
  correct: TreatmentCorrect;
}

export interface CaseRewardConfig {
  coins: number;
  hearts: number;
  affection: number;
}

export interface AuscultationSpotConfig {
  id: string;
  x: number;
  y: number;
  label?: string;
}

export interface CaseAuscultationConfig {
  abnormalSpots: AuscultationSpotConfig[];
  distractors: AuscultationSpotConfig[];
}

export interface CaseXrayLesion {
  id: string;
  x: number;
  y: number;
  label?: string;
}

/** 04 §4：病灶区域 + 相似阴影干扰，全部为卡通占位坐标。 */
export interface CaseXrayConfig {
  lesions: CaseXrayLesion[];
  shadows?: CaseXrayLesion[];
}

/** 04 §5：样本 → 试剂配对；decoys 为只出现一次的错误试剂。 */
export interface CaseLabPair {
  sample: string;
  reagent: string;
}

export interface CaseLabConfig {
  pairs: CaseLabPair[];
  decoys?: string[];
}

export interface CaseConfigItem {
  caseId: string;
  petId: string;
  petName: string;
  petSpecies: PetSpecies;
  breed: string;
  severity: Severity;
  story: string;
  symptoms: string[];
  diagnosisType: string;
  /** 10 §6.1 冻结字段：可用诊断小游戏 1-2 个；缺省回退 diagnosisType。 */
  diagnosisTypes?: string[];
  diagnosisDifficulty: number;
  auscultation?: CaseAuscultationConfig;
  xray?: CaseXrayConfig;
  lab?: CaseLabConfig;
  treatment: CaseTreatmentConfig;
  baseRewards: CaseRewardConfig;
}

interface CaseFile {
  version: number;
  cases: CaseConfigItem[];
}

const CASES_PATH = 'config/cases';

export class CaseConfigStore {
  private items: CaseConfigItem[] = [];

  get all(): readonly CaseConfigItem[] {
    return this.items;
  }

  get ready(): boolean {
    return this.items.length > 0;
  }

  async load(): Promise<boolean> {
    if (this.ready) {
      return true;
    }
    const file = await loadConfigJson<CaseFile>(CASES_PATH);
    const items = file && Array.isArray(file.cases) ? file.cases : [];
    this.items = items.length > 0 ? items : [...LOCAL_CASES];
    return this.ready;
  }

  byId(caseId: string): CaseConfigItem | null {
    return this.items.find((item) => item.caseId === caseId) ?? null;
  }

  random(excludeCaseId?: string): CaseConfigItem | null {
    const pool = excludeCaseId
      ? this.items.filter((item) => item.caseId !== excludeCaseId)
      : this.items;
    if (pool.length === 0) {
      return null;
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }
}

export const CaseConfig = new CaseConfigStore();
