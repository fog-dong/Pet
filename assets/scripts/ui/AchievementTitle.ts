// STATUS: implemented, W27 P3-UI 大厅称号条（深色玻璃底板 + 奖杯圆徽 + 可领金环与右侧星芒，带按压反馈）
import { Color, Graphics, Label, Node, UITransform, Widget } from 'cc';
import { COPY, fillCopy } from '../config/CopyText';
import { achievementViews } from '../game/Achievements';
import { claimableCount } from '../game/AchievementRules';
import { titleFor } from '../game/AchievementText';
import { makeLabel } from './FontKit';
import { lobbyHudTop } from './LobbyLayout';
import { addPill, paintRound } from './PanelKit';
import { COLORS, tint } from './Tokens';
import { addGlyphBadge, paintGlyphBadge } from './GlyphKit';
import { bindPressEffect } from './UIButton';

const PILL_W = 256;
const PILL_H = 56;
const MARGIN = 32;
const BADGE = 30;
/**
 * 深色半透明玻璃底：压在浅色场景上有分量，又不跟下方 clay 主按钮抢主色。
 * 可领时整体转暖金（底板更深一档保住白字对比），不用红点也能看出「有事可做」。
 */
const IDLE_BG = tint('#332F3B', 206);
const CLAIM_BG = tint('#4B3A1E', 224);
const IDLE_RING = tint('#FFFFFF', 46);
const CLAIM_RING = tint('#EACB8E', 230);
const SPARKLE = tint('#F5DCA6');

export interface AchievementTitleHandle {
  refresh(): void;
}

export function mountAchievementTitle(parent: Node, onOpen: () => void): AchievementTitleHandle {
  const pill = addPill(parent, 'AchievementTitle', 0, PILL_W, PILL_H, IDLE_BG);
  pinTopRightAt(pill, MARGIN, lobbyHudTop());
  const ring = new Node('AchievementTitleRing');
  ring.parent = pill;
  ring.addComponent(UITransform).setContentSize(PILL_W, PILL_H);
  ring.addComponent(Graphics);
  const badge = addGlyphBadge(pill, 'AchievementTitleBadge', 'trophy', BADGE, COLORS.clay, COLORS.white);
  badge.setPosition(-PILL_W / 2 + 26, 0, 0);
  const label = makeLabel(pill, 'AchievementTitleText', '', 0, {
    size: 21,
    width: PILL_W - 72,
    x: 12,
    color: COLORS.white,
  });
  label.overflow = Label.Overflow.SHRINK;
  pill.on(Node.EventType.TOUCH_END, onOpen);
  bindPressEffect(pill);
  const refresh = (): void => paintTitle(pill, ring, badge, label);
  refresh();
  return { refresh };
}

function paintTitle(pill: Node, ring: Node, badge: Node, label: Label): void {
  const views = achievementViews();
  const open = claimableCount(views);
  const title = titleFor(views);
  label.string = open > 0
    ? fillCopy(COPY.achievementEntryBadge, { title, n: open })
    : fillCopy(COPY.achievementEntry, { title });
  paintRound(pill, PILL_W, PILL_H, PILL_H / 2, open > 0 ? CLAIM_BG : IDLE_BG);
  paintRing(ring, open > 0 ? CLAIM_RING : IDLE_RING, open > 0);
  paintGlyphBadge(badge, open > 0 ? COLORS.gold : COLORS.mist, open > 0 ? COLORS.white : COLORS.ink);
}

/**
 * 描边必须画在子 Graphics 上：paintRound 每次换底色都会 clear 掉胶囊自己的画布。
 * 星芒画在胶囊右外侧——贴在右边缘内会被金环吃掉，看起来像裁切剩下的加号。
 */
function paintRing(ring: Node, color: Color, showSparkle: boolean): void {
  const graphics = ring.getComponent(Graphics);
  if (!graphics) {
    return;
  }
  graphics.clear();
  graphics.lineWidth = 3;
  graphics.strokeColor = color;
  graphics.roundRect(-PILL_W / 2 + 2, -PILL_H / 2 + 2, PILL_W - 4, PILL_H - 4, (PILL_H - 4) / 2);
  graphics.moveTo(-46, PILL_H / 2 - 13);
  graphics.lineTo(26, PILL_H / 2 - 13);
  graphics.stroke();
  if (!showSparkle) {
    return;
  }
  graphics.fillColor = SPARKLE;
  paintSparkle(graphics, PILL_W / 2 + 14, PILL_H / 2 - 16, 9);
  paintSparkle(graphics, PILL_W / 2 + 5, -PILL_H / 2 + 12, 6);
  graphics.fill();
}

/** 四角星：四个长尖 + 四个短肩，比等臂十字更像「闪一下」。 */
function paintSparkle(graphics: Graphics, x: number, y: number, r: number): void {
  const arm = r * 0.3;
  graphics.moveTo(x, y - r);
  graphics.lineTo(x + arm, y - arm);
  graphics.lineTo(x + r, y);
  graphics.lineTo(x + arm, y + arm);
  graphics.lineTo(x, y + r);
  graphics.lineTo(x - arm, y + arm);
  graphics.lineTo(x - r, y);
  graphics.lineTo(x - arm, y - arm);
  graphics.close();
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
