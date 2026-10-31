// STATUS: implemented, W16 宠物贴图加载（art 分包 pets/{name}.png → SpriteFrame，缺失走云存储/返回 null）
import { assetManager, SpriteFrame } from 'cc';
import { ART_BUNDLE } from '../config/BundleConfig';
import { CloudResManager } from '../net/CloudResManager';
import { Track } from '../track/Track';
import { warmArtBundle } from './ArtBundle';

/** pets.json 的 petId → 贴图名：pet_corgi → corgi。 */
export function artName(petId: string): string {
  return petId.replace(/^pet_/, '');
}

/** 云存储清单里宠物立绘的 key 约定：pet_{artName}。 */
function cloudPetKey(name: string): string {
  return `pet_${name}`;
}

const frames = new Map<string, SpriteFrame>();
const pending = new Map<string, Promise<SpriteFrame | null>>();

/** art 分包没打包、图还没画、加载失败，一律回 null，由调用方画占位。 */
export function loadPetFrame(petId: string): Promise<SpriteFrame | null> {
  const name = artName(petId);
  if (!name) {
    return Promise.resolve(null);
  }
  const cached = frames.get(name);
  if (cached !== undefined) {
    return Promise.resolve(cached);
  }
  const running = pending.get(name);
  if (running) {
    return running;
  }
  const task = warmArtBundle()
    .then((ready) => {
      const bundle = ready ? assetManager.getBundle(ART_BUNDLE) : null;
      if (!bundle) {
        return null;
      }
      return new Promise<SpriteFrame | null>((resolve) => {
        bundle.load(`pets/${name}/spriteFrame`, SpriteFrame, (error, frame) => {
          resolve(error || !frame ? null : frame);
        });
      });
    })
    .catch(() => null)
    .then((frame) => {
      if (frame) {
        return frame;
      }
      // 分包没这张图时再查云存储清单；无清单/无网/下载失败一律 null。
      return CloudResManager.loadSpriteFrame(cloudPetKey(name));
    })
    .then((frame) => {
      pending.delete(name);
      // 失败不缓存，下一次显示仍可重试（CloudResManager 内部有 3 次上限）。
      if (frame) {
        frames.set(name, frame);
      }
      Track.track(frame ? 'pet_art_ready' : 'pet_art_missing', { pet: name });
      return frame;
    });
  pending.set(name, task);
  return task;
}
