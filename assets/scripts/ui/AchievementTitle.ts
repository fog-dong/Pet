// STATUS: implemented, W25 P2-B2 大厅称号条（右上角胶囊入口；有可领时换金底并报数）
import { Label, Node, Widget } from 'cc';
import { COPY, fillCopy } from '../config/CopyText';
import { achievementViews } from '../game/Achievements';
import { claimableCount } from '../game/AchievementRules';
import { titleFor } from '../game/AchievementText';
import { makeLabel } from './FontKit';
import { lobbyHudTop } from './LobbyLayout';
import { addPill, paintRound } from './PanelKit';
import { COLORS, tint } from './Tokens';

const PILL_W = 256;
const PILL_H = 56;
const MARGIN = 32;
/** 可领提示用的浅金底：和 gold 主按钮同色系，弱一档，不跟下方玩法按钮抢。 */
const CLAIM_BG = tint('#F6E2AE');

export interface AchievementTitleHandle {
  refresh(): void;
}

export function mountAchievementTitle(parent: Node, onOpen: () => void): AchievementTitleHandle {
  const pill = addPill(parent, 'AchievementTitle', 0, PILL_W, PILL_H, COLORS.white);
  pinTopRightAt(pill, MARGIN, lobbyHudTop());
  const label = makeLabel(pill, 'AchievementTitleText', '', 0, {
    size: 22,
    width: PILL_W - 24,
    color: COLORS.ink,
  });
  label.overflow = Label.Overflow.SHRINK;
  pill.on(Node.EventType.TOUCH_END, onOpen);
  const refresh = (): void => paintTitle(pill, label);
  refresh();
  return { refresh };
}

function paintTitle(pill: Node, label: Label): void {
  const views = achievementViews();
  const open = claimableCount(views);
  const title = titleFor(views);
  label.string = open > 0
    ? fillCopy(COPY.achievementEntryBadge, { title, n: open })
    : fillCopy(COPY.achievementEntry, { title });
  paintRound(pill, PILL_W, PILL_H, PILL_H / 2, open > 0 ? CLAIM_BG : COLORS.white);
}

/** 与资源胶囊同一套贴边口径：贴安全区右上，右侧留 32。 */
function pinTopRightAt(node: Node, right: number, top: number): void {
  const widget = node.getComponent(Widget) ?? node.addComponent(Widget);
  widget.isAlignRight = true;
  widget.right = right;
  widget.isAlignTop = true;
  widget.top = top;
  widget.alignMode = Widget.AlignMode.ALWAYS;
}
