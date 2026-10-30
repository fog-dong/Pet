// STATUS: implemented, W16 宠物贴图加载（art 分包 pets/{name}.png → SpriteFrame，缺失返回 null）
import { assetManager, SpriteFrame } from 'cc';
import { ART_BUNDLE } from '../config/BundleConfig';
import { Track } from '../track/Track';
import { warmArtBundle } from './ArtBundle';

/** pets.json 的 petId → 贴图名：pet_corgi → corgi。 */
export function artName(petId: string): string {
  return petId.replace(/^pet_/, '');
}

const frames = new Map<string, SpriteFrame | null>();
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
      frames.set(name, frame);
      pending.delete(name);
      Track.track(frame ? 'pet_art_ready' : 'pet_art_missing', { pet: name });
      return frame;
    });
  pending.set(name, task);
  return task;
}
