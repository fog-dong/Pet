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

/** 病例没配点位时的兜底槽位；过近的点由 `spreadOut` 统一推开。 */
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

/** 听诊热区节点是 68×68 的方块，同层里后创建的会盖住先创建的；两个病灶中心太近时，被盖住的那个玩家怎么点都点不到
 * （实测有 3 例病例命中：大福的 chest 被 heart 压住，中心距只有 16）。所以出图前把过近的病灶沿主轴推开，
 * 只改坐标，不动数量与顺序，难度和星级口径不受影响。干扰点靠 `AuscultationView` 的创建顺序（先干扰后病灶）保证不遮挡病灶。 */
const SPOT_HIT = 72;
const MAX_SPOT_X = 210;
const MAX_SPOT_Y = 170;

function clampCoord(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value));
}

function spreadOut(spots: AuscultationSpotDef[]): void {
  for (let i = 1; i < spots.length; i += 1) {
    const spot = spots[i];
    for (let pass = 0; pass < 6; pass += 1) {
      let pushed = false;
      for (let j = 0; j < i; j += 1) {
        const other = spots[j];
        const dx = spot.x - other.x;
        const dy = spot.y - other.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) >= SPOT_HIT) {
          continue;
        }
        pushed = true;
        if (Math.abs(dx) >= Math.abs(dy)) {
          spot.x = clampCoord(other.x + (dx === 0 ? SPOT_HIT : Math.sign(dx) * SPOT_HIT), MAX_SPOT_X);
        } else {
          spot.y = clampCoord(other.y + (dy === 0 ? SPOT_HIT : Math.sign(dy) * SPOT_HIT), MAX_SPOT_Y);
        }
      }
      if (!pushed) {
        break;
      }
    }
  }
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
  spreadOut(abnormal);
  return {
    abnormal,
    distractors,
    totalMs: TOTAL_MS,
    maxMistakes: MAX_MISTAKES,
    mistakePenaltyMs: MISTAKE_PENALTY_MS,
  };
}
