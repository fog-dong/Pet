// STATUS: implemented, W17-3 音效触发点与资源位置（唯一口径：业务只传 cue，不写路径）
// 分包归属沿用 W17-2 策略；W25 音效素材落地后 9 条全部带 bundlePath，解析顺序为
// art 分包 AudioClip → 云存储清单 → 合成兜底音（分包命中时后两级自动不再触发）。
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
  | 'pet'
  | 'uiClick'
  | 'uiSuccess'
  | 'uiFail'
  | 'uiTransition';

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
  catCry: { cloudKey: 'sfx_cat_cry', bundlePath: 'audio/cat_cry', essential: true, volume: 0.6 },
  dogCry: { cloudKey: 'sfx_dog_cry', bundlePath: 'audio/dog_cry', essential: true, volume: 0.6 },
  rabbitCry: { cloudKey: 'sfx_rabbit_cry', bundlePath: 'audio/rabbit_cry', essential: true, volume: 0.5 },
  birdCry: { cloudKey: 'sfx_bird_cry', bundlePath: 'audio/bird_cry', essential: true, volume: 0.5 },
  treatOk: { cloudKey: 'sfx_treat_success', bundlePath: 'audio/treat_ok', essential: true, volume: 0.7 },
  recoverTick: { cloudKey: 'sfx_recover_tick', bundlePath: 'audio/recover_tick', essential: false, volume: 0.35 },
  // W20-2 小屋三条互动音：素材未上传时先播合成「哔」，三条各给一个音高，闭眼也能分辨做了什么。
  feed: { cloudKey: 'sfx_feed', bundlePath: 'audio/feed', essential: false, volume: 0.5, fallback: { freq: 660, ms: 110 } },
  bath: { cloudKey: 'sfx_bath', bundlePath: 'audio/bath', essential: false, volume: 0.5, fallback: { freq: 520, ms: 140 } },
  pet: { cloudKey: 'sfx_pet', bundlePath: 'audio/pet', essential: false, volume: 0.45, fallback: { freq: 780, ms: 90 } },
  // W33 四类通用反馈音：点击 / 成功 / 失败 / 转场，覆盖「每个交互都有声或动」的反馈预算。
  uiClick: { cloudKey: 'sfx_ui_click', bundlePath: 'audio/ui_click', essential: true, volume: 0.28 },
  uiSuccess: { cloudKey: 'sfx_ui_success', bundlePath: 'audio/ui_success', essential: true, volume: 0.5 },
  uiFail: { cloudKey: 'sfx_ui_fail', bundlePath: 'audio/ui_fail', essential: true, volume: 0.42 },
  uiTransition: { cloudKey: 'sfx_ui_transition', bundlePath: 'audio/ui_transition', essential: false, volume: 0.3 },
};

/** 大厅 BGM：常驻循环，低画质档不播（见 game/Bgm.ts）。 */
export interface BgmDef {
  bundlePath: string;
  volume: number;
}

export const BGM_LOBBY: BgmDef = { bundlePath: 'audio/bgm_lobby', volume: 0.16 };

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
