// STATUS: implemented, W3 病例配置（JsonAsset 加载 + 本地兜底）
import { JsonAsset, resources } from 'cc';

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
  diagnosisDifficulty: number;
  auscultation?: CaseAuscultationConfig;
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

  load(): Promise<boolean> {
    return new Promise((resolve) => {
      resources.load(CASES_PATH, JsonAsset, (error, asset) => {
        if (error || !asset) {
          resolve(false);
          return;
        }
        const raw = asset.json as CaseFile | null;
        this.items = raw && Array.isArray(raw.cases) ? raw.cases : [];
        resolve(this.ready);
      });
    });
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
