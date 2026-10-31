// STATUS: implemented, W3 图鉴弹窗（滚动列表 + 本地已救助状态）
import { BlockInputEvents, Color, Mask, Node, ScrollView, UITransform } from 'cc';
import { CharacterConfig, PetConfigItem } from '../config/CharacterConfig';
import { Save } from '../cache/Save';
import { PetVisual } from '../game/PetVisual';
import { addButton, addLabel, addRect, createNode, PALETTE } from './SceneUI';
import { fitWidth, screenHeight, screenWidth } from './ScreenMetrics';
import { addAdoptedStamp } from './CodexStamp';

const PANEL_H = 600;
const VIEW_H = 380;
const CARD_H = 96;

/** 面板与卡片宽度贴合可视宽度：720 帧下是 660/580/540。 */
function codexPanelW(): number {
  return fitWidth(1040, 30);
}

const CARD_BG = new Color(249, 239, 222, 255);
const CARD_BG_ADOPTED = new Color(241, 222, 190, 255);

export class CodexPanel {
  private overlay: Node | null = null;

  get isOpen(): boolean {
    return this.overlay !== null;
  }

  open(parent: Node): void {
    if (this.overlay) {
      return;
    }
    Save.load();
    const pets = CharacterConfig.pets;
    const adopted = pets.filter((pet) => Save.isAdopted(pet.petId)).length;

    const overlay = addRect(parent, 'CodexOverlay', 0, screenWidth(), screenHeight(), new Color(0, 0, 0, 140));
    overlay.addComponent(BlockInputEvents);
    overlay.setSiblingIndex(parent.children.length - 1);
    this.overlay = overlay;

    const panelW = codexPanelW();
    const panel = addRect(overlay, 'CodexPanel', 0, panelW, PANEL_H, PALETTE.panel);
    addLabel(panel, 'CodexTitle', `图 鉴　已领养 ${adopted}/${pets.length}`, 250, { size: 36 });
    addLabel(panel, 'CodexHint', '上下拖动可以翻看全部宠物', 206, {
      size: 19,
      color: PALETTE.sub,
      width: panelW - 140,
    });
    if (pets.length === 0) {
      addLabel(panel, 'CodexEmpty', '角色配置未加载，检查 assets/bundles/cases/config/pets.json', 0, {
        size: 26,
        color: PALETTE.sub,
        width: panelW - 140,
      });
    } else {
      this.buildList(panel, pets);
    }
    addButton(panel, 'CodexClose', '关闭', -250, () => this.close(), PALETTE.secondary, 240, 72);
  }

  close(): void {
    if (!this.overlay) {
      return;
    }
    this.overlay.destroy();
    this.overlay = null;
  }

  private buildList(panel: Node, pets: readonly PetConfigItem[]): void {
    const viewW = codexPanelW() - 80;
    const cardW = codexPanelW() - 120;
    const scrollNode = createNode(panel, 'CodexScroll', 0, viewW, VIEW_H);
    const scroll = scrollNode.addComponent(ScrollView);
    const view = createNode(scrollNode, 'view', 0, viewW, VIEW_H);
    view.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
    const content = new Node('content');
    content.parent = view;
    const contentTransform = content.addComponent(UITransform);
    contentTransform.setContentSize(cardW, Math.max(VIEW_H, pets.length * CARD_H));
    contentTransform.setAnchorPoint(0.5, 1);
    content.setPosition(0, VIEW_H / 2, 0);

    pets.forEach((pet, index) => {
      const adopted = Save.isAdopted(pet.petId);
      const y = -(index * CARD_H) - CARD_H / 2;
      const card = addRect(content, `Card_${pet.petId}`, y, cardW, CARD_H - 12, adopted ? CARD_BG_ADOPTED : CARD_BG);
      // 用真实立绘缩略图；分包未就绪时 PetVisual 自己显示占位块，不留空。
      const visual = PetVisual.mount(card, 72, false);
      visual.node.setPosition(-cardW / 2 + 76, 0, 0);
      visual.apply(pet.petId);
      addLabel(card, 'Name', `${pet.name} · ${pet.breed}`, adopted ? 12 : 0, {
        size: 28,
        width: cardW / 2,
        x: -cardW / 2 + 240,
      });
      const date = Save.adoptionDate(pet.petId);
      if (adopted) {
        addLabel(card, 'Status', `领养于 ${date}`, -18, {
          size: 20,
          color: PALETTE.primary,
          width: cardW / 2,
          x: -cardW / 2 + 240,
        });
        addAdoptedStamp(card, cardW / 2 - 88, 0);
        return;
      }
      const status = Save.snapshot().petsSeen.includes(pet.petId) ? '已救助 ♥' : '未救助';
      addLabel(card, 'Status', status, 0, {
        size: 26,
        color: PALETTE.sub,
        width: Math.min(320, cardW / 2 - 140),
        x: cardW / 2 - 160,
      });
    });

    scroll.content = content;
    scroll.vertical = true;
    scroll.horizontal = false;
    scroll.brake = 0.72;
  }
}

export const Codex = new CodexPanel();
