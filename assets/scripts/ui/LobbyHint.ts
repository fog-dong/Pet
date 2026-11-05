// STATUS: implemented, W26 P2-E 大厅常驻提示层：整屏只留一条 Label 复用，避免多句叠字
import { Label, Node } from 'cc';
import { lobbyHintY } from './LobbyLayout';
import { addLabel, PALETTE } from './SceneUI';

const HINT_W = 620;
const HINT_SIZE = 24;

export class LobbyHint {
  private label: Label | null = null;

  constructor(private readonly parent: Node) {}

  show(text: string): void {
    if (this.label) {
      this.label.string = text;
      return;
    }
    this.label = addLabel(this.parent, 'LobbyHint', text, lobbyHintY(), {
      size: HINT_SIZE,
      color: PALETTE.sub,
      width: HINT_W,
    });
    // 提示是后挂的：不提到最上层，会被底板或前台桌沿吃掉半截字。
    this.label.node.setSiblingIndex(this.parent.children.length - 1);
  }
}
