// STATUS: implemented, W4 分包加载失败时的内置兜底病例（仅 2 例，保证能进单局）
import type { CaseConfigItem } from './CaseConfig';

export const LOCAL_CASES: CaseConfigItem[] = [
  {
    caseId: 'local_cat_001',
    petId: 'pet_orange_cat',
    petName: '橘子',
    petSpecies: 'cat',
    breed: '橘猫',
    severity: 'normal',
    story: '一只吃得太快的橘猫，饭后一直干呕，主人很着急。',
    symptoms: ['干呕', '食欲下降', '精神萎靡'],
    diagnosisType: 'auscultation',
    diagnosisTypes: ['auscultation'],
    diagnosisDifficulty: 1,
    auscultation: {
      abnormalSpots: [
        { id: 'heart', x: -60, y: 60, label: '心音杂音' },
        { id: 'belly', x: 40, y: -40, label: '肠鸣音亢进' },
      ],
      distractors: [
        { id: 'chest', x: 60, y: 120 },
        { id: 'leg', x: -90, y: -110 },
      ],
    },
    treatment: {
      medicine: ['止吐药', '健胃药', '观察'],
      bed: ['住院', '门诊'],
      time: ['正常', '加速'],
      correct: { medicine: '健胃药', bed: '门诊', time: '正常' },
    },
    baseRewards: { coins: 200, hearts: 1, affection: 1 },
  },
  {
    caseId: 'local_dog_001',
    petId: 'pet_shiba',
    petName: '豆豆',
    petSpecies: 'dog',
    breed: '柴犬',
    severity: 'normal',
    story: '遛弯回来后不停抓耳朵，还甩头。',
    symptoms: ['抓耳', '甩头', '耳道有异味'],
    diagnosisType: 'lab',
    diagnosisTypes: ['lab'],
    diagnosisDifficulty: 1,
    lab: {
      pairs: [
        { sample: '耳道分泌物', reagent: '镜检' },
        { sample: '皮肤刮片', reagent: '真菌培养' },
        { sample: '血液样本', reagent: '血常规' },
      ],
      decoys: [],
    },
    treatment: {
      medicine: ['洗耳液', '消炎滴耳', '驱虫'],
      bed: ['住院', '门诊'],
      time: ['正常', '加速'],
      correct: { medicine: '消炎滴耳', bed: '门诊', time: '正常' },
    },
    baseRewards: { coins: 200, hearts: 1, affection: 1 },
  },
];
