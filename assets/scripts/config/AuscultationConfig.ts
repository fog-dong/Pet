// STATUS: implemented, W3 听诊难度与点位生成（04-诊断小游戏系统 §3.4）
import type { AuscultationSpotConfig, CaseConfigItem } from './CaseConfig';

export interface AuscultationSpotDef {
  id: string;
  x: number;
  y: number;
  label: string;
}

export interface AuscultationLayout {
  abnormal: AuscultationSpotDef[];
  distractors: AuscultationSpotDef[];
  totalMs: number;
  maxMistakes: number;
  mistakePenaltyMs: number;
}

const TOTAL_MS = 30000;
const MISTAKE_PENALTY_MS = 3000;
const MAX_MISTAKES = 3;

const RULES: Record<number, { abnormal: number; distractors: number }> = {
  1: { abnormal: 2, distractors: 2 },
  2: { abnormal: 3, distractors: 4 },
  3: { abnormal: 4, distractors: 6 },
  4: { abnormal: 4, distractors: 6 },
  5: { abnormal: 4, distractors: 6 },
};

/** 病例没配点位时的兜底槽位，保证热区不重叠。 */
const FALLBACK_SLOTS: AuscultationSpotDef[] = [
  { id: 'slot_0', x: 0, y: 140, label: '' },
  { id: 'slot_1', x: 80, y: 100, label: '' },
  { id: 'slot_2', x: -80, y: 100, label: '' },
  { id: 'slot_3', x: 0, y: 40, label: '' },
  { id: 'slot_4', x: 100, y: 0, label: '' },
  { id: 'slot_5', x: -100, y: 0, label: '' },
  { id: 'slot_6', x: 60, y: -60, label: '' },
  { id: 'slot_7', x: -60, y: -60, label: '' },
  { id: 'slot_8', x: 0, y: -110, label: '' },
  { id: 'slot_9', x: 110, y: -120, label: '' },
  { id: 'slot_10', x: -110, y: -120, label: '' },
  { id: 'slot_11', x: 0, y: -160, label: '' },
];

function toDefs(spots: AuscultationSpotConfig[], prefix: string): AuscultationSpotDef[] {
  return spots.map((spot, index) => ({
    id: spot.id || `${prefix}_${index}`,
    x: spot.x,
    y: spot.y,
    label: spot.label ?? '',
  }));
}

function slotKey(spot: { x: number; y: number }): string {
  return `${spot.x},${spot.y}`;
}

function take(
  pool: AuscultationSpotDef[],
  count: number,
  prefix: string,
  used: Set<string>,
): AuscultationSpotDef[] {
  const picked = pool.slice(0, count);
  picked.forEach((spot) => used.add(slotKey(spot)));
  if (picked.length >= count) {
    return picked;
  }
  for (const slot of FALLBACK_SLOTS) {
    if (picked.length >= count) {
      break;
    }
    if (used.has(slotKey(slot))) {
      continue;
    }
    used.add(slotKey(slot));
    picked.push({ ...slot, id: `${prefix}_${slot.id}` });
  }
  return picked;
}

export function buildLayout(item: CaseConfigItem): AuscultationLayout {
  const difficulty = Math.max(1, Math.min(5, Math.round(item.diagnosisDifficulty || 1)));
  const rule = RULES[difficulty] ?? RULES[1];
  const used = new Set<string>();
  const abnormal = take(
    toDefs(item.auscultation?.abnormalSpots ?? [], 'abn'),
    rule.abnormal,
    'abn',
    used,
  );
  const distractors = take(
    toDefs(item.auscultation?.distractors ?? [], 'dis'),
    rule.distractors,
    'dis',
    used,
  );
  return {
    abnormal,
    distractors,
    totalMs: TOTAL_MS,
    maxMistakes: MAX_MISTAKES,
    mistakePenaltyMs: MISTAKE_PENALTY_MS,
  };
}
