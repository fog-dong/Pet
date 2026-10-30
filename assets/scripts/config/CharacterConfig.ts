// STATUS: implemented, W3 角色配置（pets.json / doctors.json）
import { JsonAsset, resources } from 'cc';

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

function loadJson<T>(path: string): Promise<T | null> {
  return new Promise((resolve) => {
    resources.load(path, JsonAsset, (error, asset) => {
      if (error || !asset) {
        resolve(null);
        return;
      }
      resolve(asset.json as T);
    });
  });
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
      loadJson<PetFile>('config/pets'),
      loadJson<DoctorFile>('config/doctors'),
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
