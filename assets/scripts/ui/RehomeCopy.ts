// STATUS: implemented, W25 P2-D 送养文案与配色（通过率三档、照护度提示、告别/落选原话）
import { Color } from 'cc';
import { COLORS } from './Tokens';

export function percent(rate: number): string {
  const safe = Math.max(0, Math.min(1, Number.isFinite(rate) ? rate : 0));
  return `${Math.round(safe * 100)}%`;
}

export function rateTone(rate: number): Color {
  return rate >= 0.85 ? COLORS.sage : rate >= 0.7 ? COLORS.gold : COLORS.danger;
}

/** 低于 0.7 必须出现「照护度不足，通过率低」：这是玩家提交前唯一能看懂的风险提示。 */
export function careHint(rate: number): string {
  if (rate < 0.7) {
    return '照护度不足，通过率低';
  }
  return rate < 0.85 ? '照护度一般，还能再高一点' : '照护得很好，通过率很高';
}

/** 用户点名要的情绪文案，原文不能改。 */
export function farewell(name: string): string {
  return `好心人带走了${name}，它回头看了你一眼，仿佛在说谢谢。`;
}

export function rejected(name: string): string {
  return `${name}没遇到合适的人家，送养费用不退，它还在小屋等你。`;
}

export function generationLabel(generation: number): string {
  return generation <= 0 ? '第 1 次送养' : `第 ${generation + 1} 次送养`;
}
