// STATUS: implemented, W16 宠物立绘（Sprite 贴图 + 地面阴影 + 缺图兜底占位）
import { _decorator, Color, Component, Graphics, Label, Node, Sprite, SpriteFrame, Tween, tween, UITransform, Vec3 } from 'cc';
import { Quality } from '../config/Quality';
import { addLabel, PALETTE } from '../ui/SceneUI';
import { loadPetFrame } from './PetAssetManager';

const { ccclass } = _decorator;

const CLEAN_TINT = new Color(255, 255, 255, 255);

/** 贴图区占 size 的 86%，剩下留给地面阴影和呼吸位移。 */
const ART_RATIO = 0.86;

@ccclass('PetVisual')
export class PetVisual extends Component {
  private content: Node | null = null;
  private shadow: Node | null = null;
  private art: Sprite | null = null;
  private placeholder: Node | null = null;
  private placeholderLabel: Label | null = null;
  private tint: Color = CLEAN_TINT;
  private token = 0;

  /** 在 parent 下建一个 size 见方的宠物位；content 节点留给外层做呼吸缩放。 */
  static mount(parent: Node, size: number, withShadow = true): PetVisual {
    const node = new Node('PetVisual');
    node.parent = parent;
    node.addComponent(UITransform).setContentSize(size, size);
    const visual = node.addComponent(PetVisual);
    visual.setup(size, withShadow);
    return visual;
  }

  get contentNode(): Node | null {
    return this.content;
  }

  /** 先显示占位，贴图到位后原地替换；连续调用以最后一次为准。 */
  apply(petId: string): void {
    const token = ++this.token;
    if (this.placeholderLabel) {
      this.placeholderLabel.string = '加载中…';
    }
    void loadPetFrame(petId).then((frame) => {
      if (token !== this.token || !this.isValid) {
        return;
      }
      if (frame) {
        this.showFrame(frame);
        return;
      }
      if (this.placeholderLabel) {
        this.placeholderLabel.string = '待补图';
      }
    });
  }

  setTint(color: Color): void {
    this.tint = color;
    if (this.art) {
      this.art.color = color;
    }
  }

  protected onDestroy(): void {
    if (this.shadow) {
      Tween.stopAllByTarget(this.shadow);
    }
    if (this.content) {
      Tween.stopAllByTarget(this.content);
    }
  }

  private setup(size: number, withShadow: boolean): void {
    // 阴影先建，保证画在角色下面。
    if (withShadow) {
      this.buildShadow(size);
    }
    const content = new Node('Content');
    content.parent = this.node;
    content.setPosition(0, size * 0.04, 0);
    content.addComponent(UITransform).setContentSize(size * ART_RATIO, size * ART_RATIO);
    this.content = content;
    this.buildPlaceholder(size * ART_RATIO);
  }

  /** 阴影是独立节点：横向轻微呼吸，制造 2.5D 的贴地感。 */
  private buildShadow(size: number): void {
    const node = new Node('Shadow');
    node.parent = this.node;
    node.setPosition(0, -size * 0.42, 0);
    node.addComponent(UITransform).setContentSize(size, size * 0.16);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = new Color(0, 0, 0, 38);
    graphics.ellipse(0, 0, size * 0.28, size * 0.07);
    graphics.fill();
    this.shadow = node;
    if (Quality.low) {
      return;
    }
    tween(node)
      .to(1.1, { scale: new Vec3(1.06, 1, 1) })
      .to(1.1, { scale: Vec3.ONE })
      .union()
      .repeatForever()
      .start();
  }

  /** 缺图兜底：两层圆角矩形叠出柔和过渡；小尺寸缩略图只画色块，不塞文字。 */
  private buildPlaceholder(artSize: number): void {
    const node = new Node('Placeholder');
    node.parent = this.content;
    node.addComponent(UITransform).setContentSize(artSize, artSize);
    const width = artSize * 0.9;
    const height = artSize * 0.72;
    const radius = Math.min(width, height) * 0.18;
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = new Color(226, 220, 211, 255);
    graphics.roundRect(-width / 2, -height / 2, width, height, radius);
    graphics.fill();
    graphics.fillColor = new Color(240, 236, 229, 255);
    graphics.roundRect(-width / 2 + 6, -height / 2 + height * 0.44, width - 12, height * 0.46, radius * 0.7);
    graphics.fill();
    this.placeholder = node;
    // 图鉴缩略图只有 72 见方，字号跟着缩到 14 仍然可读；大立绘用 20。
    this.placeholderLabel = addLabel(node, 'PlaceholderText', '加载中…', -height * 0.06, {
      size: artSize < 120 ? 14 : 20,
      color: PALETTE.sub,
      width,
    });
  }

  private showFrame(frame: SpriteFrame): void {
    if (this.placeholder) {
      this.placeholder.destroy();
      this.placeholder = null;
      this.placeholderLabel = null;
    }
    if (this.art) {
      this.art.spriteFrame = frame;
      return;
    }
    const node = new Node('Art');
    node.parent = this.content;
    const transform = node.addComponent(UITransform);
    const size = this.content?.getComponent(UITransform)?.contentSize;
    if (size) {
      transform.setContentSize(size.width, size.height);
    }
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.trim = false;
    sprite.spriteFrame = frame;
    sprite.color = this.tint;
    this.art = sprite;
  }
}
