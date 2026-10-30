// STATUS: implemented, W3 图鉴弹窗（滚动列表 + 本地已救助状态）
import { BlockInputEvents, Color, Mask, Node, ScrollView, UITransform } from 'cc';
import { CharacterConfig } from '../config/CharacterConfig';
import { Save } from '../cache/Save';
import { addButton, addLabel, addRect, createNode, hexToColor, PALETTE } from './SceneUI';

const PANEL_W = 1040;
const PANEL_H = 600;
const VIEW_W = 960;
const VIEW_H = 380;
const CARD_W = 920;
const CARD_H = 96;

const CARD_BG = new Color(247, 241, 232, 255);
const CARD_BG_ADOPTED = new Color(240, 226, 200, 255);

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

    const overlay = addRect(parent, 'CodexOverlay', 0, 1280, 720, new Color(0, 0, 0, 140));
    overlay.addComponent(BlockInputEvents);
    this.overlay = overlay;

    const panel = addRect(overlay, 'CodexPanel', 0, PANEL_W, PANEL_H, PALETTE.panel);
    addLabel(panel, 'CodexTitle', `图 鉴　已救助 ${adopted}/${pets.length}`, 250, { size: 36 });
    if (pets.length === 0) {
      addLabel(panel, 'CodexEmpty', '角色配置未加载，检查 assets/resources/config/pets.json', 0, {
        size: 26,
        color: PALETTE.sub,
        width: 900,
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

  private buildList(panel: Node, pets: readonly { petId: string; name: string; breed: string; baseLook: { color: string } }[]): void {
    const scrollNode = createNode(panel, 'CodexScroll', 0, VIEW_W, VIEW_H);
    const scroll = scrollNode.addComponent(ScrollView);
    const view = createNode(scrollNode, 'view', 0, VIEW_W, VIEW_H);
    view.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
    const content = new Node('content');
    content.parent = view;
    const contentTransform = content.addComponent(UITransform);
    contentTransform.setContentSize(CARD_W, Math.max(VIEW_H, pets.length * CARD_H));
    contentTransform.setAnchorPoint(0.5, 1);
    content.setPosition(0, VIEW_H / 2, 0);

    pets.forEach((pet, index) => {
      const adopted = Save.isAdopted(pet.petId);
      const y = -(index * CARD_H) - CARD_H / 2;
      const card = addRect(content, `Card_${pet.petId}`, y, CARD_W, CARD_H - 12, adopted ? CARD_BG_ADOPTED : CARD_BG);
      addRect(card, 'Swatch', 0, 64, 64, hexToColor(pet.baseLook.color, PALETTE.sub), -390);
      addLabel(card, 'Name', `${pet.name} · ${pet.breed}`, 0, { size: 28, width: 460, x: -230 });
      addLabel(card, 'Status', adopted ? '已救助 ♥' : '未救助', 0, {
        size: 26,
        color: adopted ? PALETTE.primary : PALETTE.sub,
        width: 260,
        x: 320,
      });
    });

    scroll.content = content;
    scroll.vertical = true;
    scroll.horizontal = false;
  }
}

export const Codex = new CodexPanel();
