// STATUS: implemented, W16 宠物立绘（贴图 + 阴影 + 缺图占位）；W17-3 挂五档行为状态机与帧序列
import { _decorator, Color, Component, Label, Node, Sprite, SpriteFrame, Tween, UITransform } from 'cc';
import { artName, loadPetFrame } from './PetAssetManager';
import { PetBehavior } from './PetBehavior';
import type { PetState } from './CharacterLook';
import { buildPlaceholder, buildShadow } from './PetVisualChrome';

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
  private behavior: PetBehavior | null = null;
  private tint: Color = CLEAN_TINT;
  private token = 0;
  private petId = '';

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
    this.petId = petId;
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

  /**
   * 播放行为状态：位移始终有，帧序列只在云存储清单里存在时才播。
   * 低画质档由 PetBehavior 内部收尾为静态姿态，不跑循环。
   */
  playState(state: PetState): void {
    if (!this.behavior) {
      this.behavior = new PetBehavior(this);
    }
    this.behavior.play(state, artName(this.petId));
  }

  setTint(color: Color): void {
    this.tint = color;
    if (this.art) {
      this.art.color = color;
    }
  }

  protected onDestroy(): void {
    this.behavior?.stop();
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
      this.shadow = buildShadow(this.node, size);
    }
    const content = new Node('Content');
    content.parent = this.node;
    content.setPosition(0, size * 0.04, 0);
    content.addComponent(UITransform).setContentSize(size * ART_RATIO, size * ART_RATIO);
    this.content = content;
    const placeholder = buildPlaceholder(content, size * ART_RATIO);
    this.placeholder = placeholder.node;
    this.placeholderLabel = placeholder.label;
  }

  /** 行为帧与静态立绘共用这条显示路径：占位一次销毁，之后只换 spriteFrame。 */
  showFrame(frame: SpriteFrame): void {
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
