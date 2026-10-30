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
