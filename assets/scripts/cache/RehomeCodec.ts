// STATUS: implemented, W25 P2-D 送养存档编解码（纯函数；rehomed 是 M1 拆雷的持久化凭据）
import { toNonNegativeInt, toStringArray } from './SaveFields';

export interface RehomeReview {
  petId: string;
  /** 审核完成时间戳 ms（本地墙钟）；到点前不可领结果。 */
  readyAt: number;
  /** 提交时按照护度算好并存档，审核结果只掷一次，读档不会重算。 */
  rate: number;
}

export interface RehomeState {
  /** 已送走的宠物 id。`petsAdopted` 保留（图鉴永久点亮），小屋必须过滤掉这里的人。 */
  rehomed: string[];
  /** 同一时间只排一个审核；null 表示当前没有待领结果。 */
  review: RehomeReview | null;
}

export function emptyRehome(): RehomeState {
  return { rehomed: [], review: null };
}

export function isRehomed(state: Pick<RehomeState, 'rehomed'>, petId: string): boolean {
  return state.rehomed.indexOf(petId) >= 0;
}

/** M2 拆雷：图鉴永久保留 petsAdopted，领养位占用必须扣掉已送走的，且不为负。 */
export function liveAdopted(petsAdopted: readonly string[], state: Pick<RehomeState, 'rehomed'>): number {
  return Math.max(0, petsAdopted.length - state.rehomed.length);
}

function decodeReview(value: unknown): RehomeReview | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as Partial<RehomeReview>;
  if (typeof raw.petId !== 'string' || !raw.petId) {
    return null;
  }
  return {
    petId: raw.petId,
    readyAt: toNonNegativeInt(raw.readyAt, 0),
    rate: Math.max(0, Math.min(1, typeof raw.rate === 'number' && Number.isFinite(raw.rate) ? raw.rate : 0)),
  };
}

export function decodeRehome(value: unknown): RehomeState {
  if (!value || typeof value !== 'object') {
    return emptyRehome();
  }
  const raw = value as Partial<RehomeState>;
  const rehomed = toStringArray(raw.rehomed).filter(
    (petId, index, list) => petId !== '' && list.indexOf(petId) === index,
  );
  return { rehomed, review: decodeReview(raw.review) };
}
