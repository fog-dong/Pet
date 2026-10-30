// STATUS: implemented, W3 角色展示（art 贴图 + 名字 + 心情图标，缺图走占位兜底）
import { _decorator, Component, Label, Node, Tween, tween, UITransform, Vec3 } from 'cc';
import { CharacterConfig } from '../config/CharacterConfig';
import { Quality } from '../config/Quality';
import { addLabel } from '../ui/SceneUI';
import { CLEAN_TINT, mixColor, MOOD_ICON, SICK_TINT } from './CharacterLook';
import type { CharacterMood } from './CharacterLook';
import { PetVisual } from './PetVisual';

const { ccclass } = _decorator;

const BODY_SIZE = 150;

export type { CharacterMood } from './CharacterLook';

@ccclass('CharacterView')
export class CharacterView extends Component {
  private visual: PetVisual | null = null;
  private nameLabel: Label | null = null;
  private statusLabel: Label | null = null;
  private currentMood: CharacterMood = 'idle';
  private unsubscribe: (() => void) | null = null;
  private bodySize = BODY_SIZE;

  /** 场景里挂一个角色位，返回可继续调 showPet / showDoctor 的组件；size 决定立绘边长。 */
  static mount(parent: Node, x: number, y: number, size = BODY_SIZE): CharacterView {
    const node = new Node('CharacterView');
    // 先关掉再挂组件：onLoad 里的 build 要读到 mount 传进来的尺寸。
    node.active = false;
    node.parent = parent;
    node.setPosition(x, y, 0);
    const view = node.addComponent(CharacterView);
    view.bodySize = size;
    node.active = true;
    return view;
  }

  protected onLoad(): void {
    this.build();
  }

  protected onEnable(): void {
    // 画质档位可能在单局中途由远程配置切换：按当前心情重放一次，low 档会停在静态姿态。
    this.unsubscribe = Quality.subscribe(() => this.playMood(this.currentMood));
  }

  protected onDisable(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  showPet(petId: string, mood: CharacterMood = 'idle'): void {
    this.build();
    const pet = CharacterConfig.petById(petId);
    this.setTitle(pet ? `${pet.name} · ${pet.breed}` : '未知宠物');
    this.visual?.apply(pet ? petId : '');
    this.visual?.setTint(mood === 'sick' ? SICK_TINT : CLEAN_TINT);
    this.playMood(mood);
  }

  /** 医生立绘与宠物共用一套加载与占位逻辑，没出图时同样显示「暂缺图片」。 */
  showDoctor(doctorId: string): void {
    this.build();
    const doctor = CharacterConfig.doctorById(doctorId);
    this.setTitle(doctor ? `${doctor.name} · ${doctor.role}` : '未知医生');
    this.visual?.apply(doctor ? doctorId : '');
    this.visual?.setTint(CLEAN_TINT);
    this.playMood('idle');
  }

  playIdle(): void {
    this.playMood('idle');
  }

  /** 页面自己已经给出名字/状态（大厅、接诊页）时关掉立绘角标，避免叠字。 */
  hideBadges(): void {
    this.build();
    if (this.nameLabel) {
      this.nameLabel.node.active = false;
    }
    if (this.statusLabel) {
      this.statusLabel.node.active = false;
    }
  }

  playSick(): void {
    this.visual?.setTint(SICK_TINT);
    this.playMood('sick');
  }

  playRecovered(): void {
    this.visual?.setTint(CLEAN_TINT);
    this.playMood('recovered');
  }

  /** 康复进度：贴图从「生病灰调」逐渐提亮回原色。 */
  setRecoveryProgress(ratio: number): void {
    this.visual?.setTint(mixColor(SICK_TINT, CLEAN_TINT, ratio));
  }

  /** 美术到位后在这里替换成 Spine / Animation。 */
  private playMood(mood: CharacterMood): void {
    this.currentMood = mood;
    if (this.statusLabel) {
      this.statusLabel.string = MOOD_ICON[mood];
    }
    const content = this.visual?.contentNode;
    if (!content) {
      return;
    }
    Tween.stopAllByTarget(content);
    content.setScale(Vec3.ONE);
    if (mood === 'sick') {
      content.setScale(new Vec3(0.94, 0.94, 1));
      return;
    }
    if (Quality.low) {
      return;
    }
    const amplitude = mood === 'recovered' ? 1.06 : 1.03;
    tween(content)
      .to(1.1, { scale: new Vec3(amplitude, amplitude, 1) })
      .to(1.1, { scale: Vec3.ONE })
      .union()
      .repeatForever()
      .start();
  }

  private build(): void {
    if (this.visual) {
      return;
    }
    const size = this.bodySize;
    this.node.addComponent(UITransform).setContentSize(size + 90, size + 90);
    this.visual = PetVisual.mount(this.node, size);
    const offset = size * 0.66;
    this.nameLabel = addLabel(this.node, 'Name', '', -offset, { size: 28, width: 300 });
    this.statusLabel = addLabel(this.node, 'Status', '', offset, { size: 30, width: 200 });
  }

  private setTitle(text: string): void {
    if (this.nameLabel) {
      this.nameLabel.string = text;
    }
  }
}
