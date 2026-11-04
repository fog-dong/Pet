// STATUS: implemented, W25 P1-A 开箱动效（盖子抛飞 + 箱体挤压 + 宠物 backOut 弹出 + 稀有度光环）
import { Node, Tween, UIOpacity, Vec3, tween } from 'cc';
import { Quality } from '../config/Quality';
import type { GachaDraw } from '../game/Gacha';
import { PetVisual } from '../game/PetVisual';
import { GachaBoxHandle, makeGlow } from './GachaArt';
import { spawnHearts } from './ParticleKit';
import { tint } from './Tokens';

export interface GachaRevealHandle {
  reveal(draw: GachaDraw, box: GachaBoxHandle, onDone: () => void): void;
  reset(box: GachaBoxHandle): void;
}

export function bindGachaReveal(root: Node, petY: number, gold: string): GachaRevealHandle {
  let petHolder: Node | null = null;
  let glow: Node | null = null;

  function clear(): void {
    petHolder?.destroy();
    petHolder = null;
    glow?.destroy();
    glow = null;
  }

  function openBox(box: GachaBoxHandle): void {
    Tween.stopAllByTarget(box.rootOpacity);
    box.rootOpacity.opacity = 255;
    box.lidOpacity.opacity = 255;
    tween(box.lid)
      .to(0.46, { position: new Vec3(150, 280, 0), angle: -170 }, { easing: 'quadOut' })
      .start();
    tween(box.lidOpacity).to(0.4, { opacity: 0 }, { easing: 'quadIn' }).start();
    // 结果卡落位后箱体退场，避免空纸箱压在卡片上沿。
    tween(box.rootOpacity).delay(0.92).to(0.28, { opacity: 0 }, { easing: 'quadIn' }).start();
    Tween.stopAllByTarget(box.body);
    tween(box.body)
      .to(0.09, { scale: new Vec3(1.14, 0.84, 1) }, { easing: 'quadIn' })
      .to(0.26, { scale: Vec3.ONE }, { easing: 'backOut' })
      .start();
  }

  function reveal(draw: GachaDraw, box: GachaBoxHandle, onDone: () => void): void {
    clear();
    openBox(box);
    const holder = new Node('GachaPet');
    holder.parent = root;
    holder.setPosition(0, petY, 0);
    petHolder = holder;
    const visual = PetVisual.mount(holder, 300, false);
    visual.apply(draw.petId);
    if (draw.tint) {
      visual.setTint(tint(draw.tint));
    }
    const fade = holder.addComponent(UIOpacity);
    fade.opacity = 0;
    holder.setScale(0.2, 0.2, 1);
    tween(holder).delay(0.08).to(0.42, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
    tween(fade)
      .delay(0.08)
      .to(0.3, { opacity: 255 })
      .call(() => {
        if (!Quality.low) {
          visual.playState('happy');
        }
        spawnHearts(root, { x: 0, y: petY + 120 }, 8);
        onDone();
      })
      .start();

    const glowNode = makeGlow(root, draw.tint || gold, petY);
    glowNode.setScale(0.5, 0.5, 1);
    const glowFade = glowNode.addComponent(UIOpacity);
    glowFade.opacity = 0;
    glow = glowNode;
    tween(glowNode).delay(0.06).to(0.34, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
    tween(glowFade)
      .delay(0.06)
      .to(0.3, { opacity: 255 })
      .call(() => {
        if (!Quality.low && glowNode.isValid) {
          tween(glowNode)
            .repeatForever(
              tween(glowNode)
                .to(0.9, { scale: new Vec3(1.05, 1.05, 1) })
                .to(0.9, { scale: Vec3.ONE }),
            )
            .start();
        }
      })
      .start();
  }

  function reset(box: GachaBoxHandle): void {
    clear();
    Tween.stopAllByTarget(box.body);
    Tween.stopAllByTarget(box.lid);
    Tween.stopAllByTarget(box.lidOpacity);
    Tween.stopAllByTarget(box.rootOpacity);
    box.body.setScale(Vec3.ONE);
    box.lid.setPosition(0, box.lidHomeY, 0);
    box.lid.angle = 0;
    box.lidOpacity.opacity = 255;
    box.rootOpacity.opacity = 255;
  }

  return { reveal, reset };
}
