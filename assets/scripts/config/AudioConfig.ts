// STATUS: implemented, W17-3 音效触发点与资源位置（唯一口径：业务只传 cue，不写路径）
// 分包归属沿用 W17-2 策略：短促的进度提示音进 art 分包，体积大的动物叫声只走云存储清单。
import type { PetSpecies } from './CharacterConfig';

export type AudioCue = 'catCry' | 'dogCry' | 'rabbitCry' | 'birdCry' | 'treatOk' | 'recoverTick';

export interface AudioDef {
  /** 云存储清单里的 key（resource_manifest.files[].key）。 */
  cloudKey: string;
  /** art 分包内的 AudioClip 路径；空字符串表示这张音效不落分包，只走云存储。 */
  bundlePath: string;
  /** 低画质档位下是否仍然播放：与玩法反馈直接相关的算必要音效。 */
  essential: boolean;
  volume: number;
}

export const AUDIO_TABLE: Record<AudioCue, AudioDef> = {
  catCry: { cloudKey: 'sfx_cat_cry', bundlePath: '', essential: true, volume: 0.6 },
  dogCry: { cloudKey: 'sfx_dog_cry', bundlePath: '', essential: true, volume: 0.6 },
  rabbitCry: { cloudKey: 'sfx_rabbit_cry', bundlePath: '', essential: true, volume: 0.5 },
  birdCry: { cloudKey: 'sfx_bird_cry', bundlePath: '', essential: true, volume: 0.5 },
  treatOk: { cloudKey: 'sfx_treat_success', bundlePath: '', essential: true, volume: 0.7 },
  recoverTick: { cloudKey: 'sfx_recover_tick', bundlePath: 'audio/ui/recoverTick', essential: false, volume: 0.35 },
};

const SPECIES_CUE: Record<PetSpecies, AudioCue> = {
  cat: 'catCry',
  dog: 'dogCry',
  rabbit: 'rabbitCry',
  bird: 'birdCry',
};

/** 品种 → 轻柔叫声；配置缺字段或出现未登记的品种时返回 null，由 Sfx 直接跳过。 */
export function speciesCue(species: PetSpecies | undefined | null): AudioCue | null {
  if (!species) {
    return null;
  }
  return SPECIES_CUE[species] ?? null;
}
