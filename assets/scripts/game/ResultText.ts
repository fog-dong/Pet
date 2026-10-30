// STATUS: implemented, W7 结算文案（星级与累计资源，从 Result 拆出控制行数）
import { Save } from '../cache/Save';

export function starText(stars: number): string {
  const clamped = Math.max(0, Math.min(3, stars));
  return `${'★'.repeat(clamped)}${'☆'.repeat(3 - clamped)}`;
}

export function totalText(): string {
  return `累计金币 ${Save.coins}　累计爱心 ${Save.hearts}　已治愈 ${Save.casesDone} 例`;
}
