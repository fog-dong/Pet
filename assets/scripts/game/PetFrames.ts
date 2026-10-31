// STATUS: implemented, W17-3 行为帧序列加载（云存储清单前缀 → SpriteFrame[]，无清单返回空数组）
// 帧序列只走云存储：一个状态 3–6 帧的体积不适合压进 art 分包（00 §5 包体预算）。
import { SpriteFrame } from 'cc';
import { CloudResManager } from '../net/CloudResManager';
import type { PetState } from './CharacterLook';

/** 清单 key 约定：pet_{artName}_{state}_{01}，序号两位补零，字典序即播放序。 */
export function statePrefix(artName: string, state: PetState): string {
  return `pet_${artName}_${state}_`;
}

const MAX_FRAMES = 8;
const cache = new Map<string, SpriteFrame[]>();
const pending = new Map<string, Promise<SpriteFrame[]>>();

/** 取到帧就缓存；空结果不缓存，清单晚到后下一次播放能拿到帧。 */
export function loadStateFrames(artName: string, state: PetState): Promise<SpriteFrame[]> {
  if (!artName) {
    return Promise.resolve([]);
  }
  const cacheKey = `${artName}:${state}`;
  const hit = cache.get(cacheKey);
  if (hit) {
    return Promise.resolve(hit);
  }
  const running = pending.get(cacheKey);
  if (running) {
    return running;
  }
  const task = fetchFrames(artName, state).then((frames) => {
    pending.delete(cacheKey);
    if (frames.length > 0) {
      cache.set(cacheKey, frames);
    }
    return frames;
  });
  pending.set(cacheKey, task);
  return task;
}

async function fetchFrames(artName: string, state: PetState): Promise<SpriteFrame[]> {
  const entries = CloudResManager.entriesWithPrefix(statePrefix(artName, state)).slice(0, MAX_FRAMES);
  const frames: SpriteFrame[] = [];
  for (const entry of entries) {
    const frame = await CloudResManager.loadSpriteFrame(entry.key);
    if (frame) {
      frames.push(frame);
    }
  }
  return frames;
}
