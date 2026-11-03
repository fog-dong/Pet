// STATUS: implemented, W25-P0C5 图鉴弹窗（双列虚拟列表 + 本地已救助状态）
import { BlockInputEvents, Color, Node } from 'cc';
import { CharacterConfig } from '../config/CharacterConfig';
import { Save } from '../cache/Save';
import { addButton, addLabel, addRect, PALETTE } from './SceneUI';
import { fitWidth, screenHeight, screenWidth } from './ScreenMetrics';
import { mountCodexList } from './CodexWindow';

const PANEL_H = 600;

/** 面板与列表宽度贴合可视宽度：720 帧下是 660 / 540（双列 264 + 12 + 264）。 */
function codexPanelW(): number {
  return fitWidth(1040, 30);
}

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
      mountCodexList(panel, pets, panelW - 120);
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
}

export const Codex = new CodexPanel();
