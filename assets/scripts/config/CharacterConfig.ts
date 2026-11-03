// STATUS: implemented, W4 角色配置（cases 分包加载 pets.json / doctors.json）
import { loadConfigJson } from './ConfigLoader';

export type PetSpecies = 'cat' | 'dog' | 'rabbit' | 'bird';
export type LookShape = 'circle' | 'square';

export interface PetColors {
  sick: string;
  idle: string;
  recovered: string;
}

export interface PetConfigItem {
  petId: string;
  name: string;
  breed: string;
  species: PetSpecies;
  baseLook: { color: string; shape: LookShape };
  colors: PetColors;
  /** 领养页性格标签；缺省时由 AdoptionNote 的占位池兜底。 */
  traits?: string[];
  /** 领养寄语；缺省时按 petId 稳定选一句占位文案。 */
  message?: string;
  /**
   * G2 新增的三项属性初始值，与 10 §3.4 `pets` 集合同名字段一一对应。
   * 这里是品种默认，不是个体的当前值——个体值只活在本地产存档（偏差 D19）。
   */
  hunger?: number;
  cleanliness?: number;
  mood?: number;
  /**
   * W22-1 生命周期三字段，单位一律是**现实自然日**（2026-11-03 拍板：不引入加速倍率）。
   * `expectedLifespanDays` 只用于进度条分母——宠物不会死（沿用 W20 方案 §2.2 硬约束）。
   * 三者缺省时由 game/AgeSystem 的 DEFAULT_LIFESPAN 兜底，业务代码不得按 petId 分支。
   */
  expectedLifespanDays?: number;
  maturityAgeDays?: number;
  seniorAgeDays?: number;
}

export interface DoctorConfigItem {
  doctorId: string;
  name: string;
  role: string;
  bonus: string;
}

interface PetFile {
  version: number;
  pets: PetConfigItem[];
}

interface DoctorFile {
  version: number;
  doctors: DoctorConfigItem[];
}

export class CharacterConfigStore {
  private petItems: PetConfigItem[] = [];
  private doctorItems: DoctorConfigItem[] = [];

  get pets(): readonly PetConfigItem[] {
    return this.petItems;
  }

  get doctors(): readonly DoctorConfigItem[] {
    return this.doctorItems;
  }

  get ready(): boolean {
    return this.petItems.length > 0;
  }

  async load(): Promise<boolean> {
    if (this.ready) {
      return true;
    }
    const [petFile, doctorFile] = await Promise.all([
      loadConfigJson<PetFile>('config/pets'),
      loadConfigJson<DoctorFile>('config/doctors'),
    ]);
    this.petItems = petFile && Array.isArray(petFile.pets) ? petFile.pets : [];
    this.doctorItems = doctorFile && Array.isArray(doctorFile.doctors) ? doctorFile.doctors : [];
    return this.ready;
  }

  petById(petId: string): PetConfigItem | null {
    return this.petItems.find((item) => item.petId === petId) ?? null;
  }

  doctorById(doctorId: string): DoctorConfigItem | null {
    return this.doctorItems.find((item) => item.doctorId === doctorId) ?? null;
  }
}

export const CharacterConfig = new CharacterConfigStore();
