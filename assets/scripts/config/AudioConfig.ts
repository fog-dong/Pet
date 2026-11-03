// STATUS: implemented, W17-3 音效触发点与资源位置（唯一口径：业务只传 cue，不写路径）
// 分包归属沿用 W17-2 策略；W24-2 复核后 9 条音效全部只走云存储清单（assets 下暂无 AudioClip 文件，
// 一旦某条素材落进分包，把它的 bundlePath 填上即可自动优先读分包，业务层不用改）。
import type { PetSpecies } from './CharacterConfig';

export type AudioCue =
  | 'catCry'
  | 'dogCry'
  | 'rabbitCry'
  | 'birdCry'
  | 'treatOk'
  | 'recoverTick'
  | 'feed'
  | 'bath'
  | 'pet';

export interface AudioDef {
  /** 云存储清单里的 key（resource_manifest.files[].key）。 */
  cloudKey: string;
  /** art 分包内的 AudioClip 路径；空字符串表示这张音效不落分包，只走云存储。 */
  bundlePath: string;
  /** 低画质档位下是否仍然播放：与玩法反馈直接相关的算必要音效。 */
  essential: boolean;
  volume: number;
  /**
   * 素材还没上传时的合成兜底音（分包 → 云存储 → 兜底 三级顺序）。
   * 只给互动反馈这类「必须有声」的短音配，真实音频到位后这一级自动不再触发。
   */
  fallback?: FallbackTone;
}

/** 兜底提示音参数：freq 正弦频率（Hz），ms 时长。 */
export interface FallbackTone {
  freq: number;
  ms: number;
}

export const AUDIO_TABLE: Record<AudioCue, AudioDef> = {
  catCry: { cloudKey: 'sfx_cat_cry', bundlePath: '', essential: true, volume: 0.6 },
  dogCry: { cloudKey: 'sfx_dog_cry', bundlePath: '', essential: true, volume: 0.6 },
  rabbitCry: { cloudKey: 'sfx_rabbit_cry', bundlePath: '', essential: true, volume: 0.5 },
  birdCry: { cloudKey: 'sfx_bird_cry', bundlePath: '', essential: true, volume: 0.5 },
  treatOk: { cloudKey: 'sfx_treat_success', bundlePath: '', essential: true, volume: 0.7 },
  // W24-2：原先写 `audio/ui/recoverTick`，但 art 分包下只有 `pets/` 立绘、assets 里也没有任何
  // AudioClip 文件，这条路径永远命中不了；按本表约定改为空串，明确它只走云存储清单。
  recoverTick: { cloudKey: 'sfx_recover_tick', bundlePath: '', essential: false, volume: 0.35 },
  // W20-2 小屋三条互动音：素材未上传时先播合成「哔」，三条各给一个音高，闭眼也能分辨做了什么。
  feed: { cloudKey: 'sfx_feed', bundlePath: '', essential: false, volume: 0.5, fallback: { freq: 660, ms: 110 } },
  bath: { cloudKey: 'sfx_bath', bundlePath: '', essential: false, volume: 0.5, fallback: { freq: 520, ms: 140 } },
  pet: { cloudKey: 'sfx_pet', bundlePath: '', essential: false, volume: 0.45, fallback: { freq: 780, ms: 90 } },
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
