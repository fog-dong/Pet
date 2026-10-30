// STATUS: implemented, W18-2 医院等级/医生配置（07 §3.1 / §4 初值，数值可在软测后调）
export interface HospitalLevelConfig {
  level: number;
  /** 升到该等级需要的金币；1 级为初始。 */
  cost: number;
  beds: number;
  /** 该等级累计的领养位加成（在 3 个基础位之上）。 */
  slotBonus: number;
  unlock: string;
}

export const HOSPITAL_LEVELS: readonly HospitalLevelConfig[] = [
  { level: 1, cost: 0, beds: 2, slotBonus: 0, unlock: '门诊 · 2 张床位' },
  { level: 2, cost: 2000, beds: 2, slotBonus: 2, unlock: '化验室 · 领养位 +2' },
  { level: 3, cost: 3000, beds: 4, slotBonus: 2, unlock: '住院部 · 床位 +2' },
  { level: 4, cost: 6000, beds: 4, slotBonus: 5, unlock: '手术室 · 领养位 +3' },
  { level: 5, cost: 7000, beds: 7, slotBonus: 5, unlock: '康复花园 · 床位 +3' },
  { level: 6, cost: 10000, beds: 7, slotBonus: 10, unlock: '领养区扩建 · 领养位 +5' },
];

export interface DoctorConfig {
  id: string;
  name: string;
  /** 医院达到该等级才入驻。 */
  level: number;
}

/** 07 §4 医生表：P2 才接排班与加成，本轮只在大厅面板展示入驻状态。 */
export const DOCTORS: readonly DoctorConfig[] = [
  { id: 'doc_intern', name: '实习医生', level: 1 },
  { id: 'doc_physician', name: '内科医生', level: 2 },
  { id: 'doc_surgeon', name: '外科医生', level: 3 },
  { id: 'doc_imaging', name: '影像医生', level: 4 },
  { id: 'doc_emergency', name: '急诊医生', level: 5 },
];
