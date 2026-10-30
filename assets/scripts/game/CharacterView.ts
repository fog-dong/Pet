// STATUS: implemented, W3 角色展示（色块 + 名字 + 状态图标，纯 Cocos 绘制）
import { _decorator, Color, Component, Graphics, Label, Node, tween, Tween, UITransform, Vec3 } from 'cc';
import { CharacterConfig } from '../config/CharacterConfig';
import { Quality } from '../config/Quality';
import { addLabel, hexToColor } from '../ui/SceneUI';

const { ccclass } = _decorator;

export type CharacterMood = 'idle' | 'sick' | 'recovered';

const BODY_SIZE = 150;
const FALLBACK_COLOR = new Color(200, 195, 188, 255);
const MOOD_ICON: Record<CharacterMood, string> = { idle: '●', sick: '✚', recovered: '♥' };

function mixColor(from: Color, to: Color, ratio: number): Color {
  const t = Math.max(0, Math.min(1, ratio));
  return new Color(
    Math.round(from.r + (to.r - from.r) * t),
    Math.round(from.g + (to.g - from.g) * t),
    Math.round(from.b + (to.b - from.b) * t),
    255,
  );
}

@ccclass('CharacterView')
export class CharacterView extends Component {
  private body: Node | null = null;
  private graphics: Graphics | null = null;
  private nameLabel: Label | null = null;
  private statusLabel: Label | null = null;
  private sickColor: Color = FALLBACK_COLOR;
  private recoveredColor: Color = FALLBACK_COLOR;
  private shape: 'circle' | 'square' = 'circle';

  /** 场景里挂一个角色位，返回可继续调 showPet / showDoctor 的组件。 */
  static mount(parent: Node, x: number, y: number): CharacterView {
    const node = new Node('CharacterView');
    node.parent = parent;
    node.setPosition(x, y, 0);
    return node.addComponent(CharacterView);
  }

  protected onLoad(): void {
    this.build();
  }

  showPet(petId: string, mood: CharacterMood = 'idle'): void {
    this.build();
    const pet = CharacterConfig.petById(petId);
    if (!pet) {
      this.setTitle('未知宠物');
      this.draw(FALLBACK_COLOR, 'circle');
      this.playMood(mood);
      return;
    }
    this.sickColor = hexToColor(pet.colors.sick, FALLBACK_COLOR);
    this.recoveredColor = hexToColor(pet.colors.recovered, FALLBACK_COLOR);
    this.shape = pet.baseLook.shape;
    this.setTitle(`${pet.name} · ${pet.breed}`);
    this.draw(hexToColor(pet.baseLook.color, FALLBACK_COLOR), pet.baseLook.shape);
    this.playMood(mood);
  }

  showDoctor(doctorId: string): void {
    this.build();
    const doctor = CharacterConfig.doctorById(doctorId);
    this.shape = 'square';
    this.setTitle(doctor ? `${doctor.name} · ${doctor.role}` : '未知医生');
    this.draw(hexToColor('#8FAE9F', FALLBACK_COLOR), 'square');
    this.playMood('idle');
  }

  playIdle(): void {
    this.playMood('idle');
  }

  playSick(): void {
    this.playMood('sick');
  }

  playRecovered(): void {
    this.playMood('recovered');
    this.draw(this.recoveredColor, this.shape);
  }

  /** 康复进度：色块从“生病灰”渐变到“康复暖色”。 */
  setRecoveryProgress(ratio: number): void {
    this.draw(mixColor(this.sickColor, this.recoveredColor, ratio), this.shape);
  }

  /** 美术到位后在这里替换成 Spine / Animation。 */
  private playMood(mood: CharacterMood): void {
    if (this.statusLabel) {
      this.statusLabel.string = MOOD_ICON[mood];
    }
    const body = this.body;
    if (!body) {
      return;
    }
    Tween.stopAllByTarget(body);
    body.setScale(Vec3.ONE);
    if (mood === 'sick') {
      body.setScale(new Vec3(0.94, 0.94, 1));
      return;
    }
    if (Quality.low) {
      return;
    }
    const amplitude = mood === 'recovered' ? 1.06 : 1.03;
    tween(body)
      .to(1.1, { scale: new Vec3(amplitude, amplitude, 1) })
      .to(1.1, { scale: Vec3.ONE })
      .union()
      .repeatForever()
      .start();
  }

  private build(): void {
    if (this.body) {
      return;
    }
    this.node.addComponent(UITransform).setContentSize(240, 240);
    const body = new Node('Body');
    body.parent = this.node;
    body.addComponent(UITransform).setContentSize(BODY_SIZE, BODY_SIZE);
    this.body = body;
    this.graphics = body.addComponent(Graphics);
    this.nameLabel = addLabel(this.node, 'Name', '', -100, { size: 28, width: 300 });
    this.statusLabel = addLabel(this.node, 'Status', '', 100, { size: 30, width: 200 });
    this.draw(FALLBACK_COLOR, 'circle');
  }

  private setTitle(text: string): void {
    if (this.nameLabel) {
      this.nameLabel.string = text;
    }
  }

  private draw(color: Color, shape: 'circle' | 'square'): void {
    const graphics = this.graphics;
    if (!graphics) {
      return;
    }
    graphics.clear();
    graphics.fillColor = color;
    if (shape === 'square') {
      graphics.rect(-BODY_SIZE / 2, -BODY_SIZE / 2, BODY_SIZE, BODY_SIZE);
    } else {
      graphics.circle(0, 0, BODY_SIZE / 2);
    }
    graphics.fill();
  }
}
