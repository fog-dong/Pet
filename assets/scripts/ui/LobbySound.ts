// STATUS: implemented, W33 大厅音乐开关：开态纸白底 + 音箱，关态沙色底 + 斜杠
// 手机两行 HUD：称号在左、音乐开关并排其右；平板一行不够就退回右上角、挂在称号条下方。
import { Graphics, Node, Tween, tween, UITransform, Vec3 } from 'cc';
import { Bgm } from '../game/Bgm';
import { drawGlyph } from './GlyphKit';
import { lobbyHudLeft, lobbyHudRows, lobbyHudSecondTop, lobbyHudTop, TITLE_PILL_W } from './LobbyLayout';
import { addShadow, createBox, paintRound } from './PanelKit';
import { pinTopLeftAt, pinTopRightAt } from './SafeLayout';
import { COLORS, DURATION } from './Tokens';
import { bindPressEffect } from './UIButton';

const SIZE = 56;
const MARGIN = 32;
const ICON = 30;
/** 称号条高 56：单行时音乐开关挂在它正下方，右边缘对齐，避开 HUD 与称号条两处点击区。 */
const TITLE_H = 56;
const GAP = 14;
/** 并排间隙 26：称号条右侧星芒探出 23，再留 3 才算真的没碰上。 */
const SIDE_GAP = 26;

export function mountBgmToggle(parent: Node): Node {
  const root = createBox(parent, 'BgmToggle', 0, SIZE, SIZE);
  if (lobbyHudRows() > 1) {
    pinTopLeftAt(root, lobbyHudLeft() + TITLE_PILL_W + SIDE_GAP, lobbyHudSecondTop());
  } else {
    pinTopRightAt(root, MARGIN, lobbyHudTop() + TITLE_H + GAP);
  }
  const face = createBox(root, 'BgmToggleFace', 0, SIZE, SIZE);
  addShadow(root, face, SIZE, SIZE, SIZE / 2, 4, 52);
  const icon = new Node('BgmToggleIcon');
  icon.parent = face;
  icon.addComponent(UITransform).setContentSize(ICON, ICON);
  const graphics = icon.addComponent(Graphics);
  let muted = Bgm.muted();
  const paint = (): void => {
    paintRound(face, SIZE, SIZE, SIZE / 2, muted ? COLORS.skirt : COLORS.paper);
    graphics.clear();
    drawGlyph(graphics, muted ? 'speakerOff' : 'speaker', 0, 0, ICON, muted ? COLORS.sub : COLORS.clay);
  };
  paint();
  bindPressEffect(root);
  root.on(Node.EventType.TOUCH_END, () => {
    muted = Bgm.toggle();
    paint();
    Tween.stopAllByTarget(icon);
    icon.setScale(0.72, 0.72, 1);
    tween(icon).to(DURATION.release, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
  });
  return root;
}
