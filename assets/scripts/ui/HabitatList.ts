// STATUS: implemented, W25 P1-C 小屋列表装配（从 HabitatPanel 拆出守住 150 行；支持主题卡片底色）；W28 P1-2 顺带收编滚动提示
import { Color, Mask, Node, ScrollView, UITransform, Vec2 } from 'cc';
import { HabitatPet } from '../cache/HabitatCodec';
import { addLabel, createNode, PALETTE } from './SceneUI';
import { buildHabitatRow, HABITAT_CARD_H, HabitatRow, RowAction, RowCommand } from './HabitatRows';

/** 视口高度刻意留到 500：底部要空出 35px 给滚动提示，别让最后一张卡压着文字。 */
const VIEW_H = 500;
/** 卡片比旧版宽 20：立绘放大到 190 后左右两栏需要这点余量，560 是面板 660 减两侧 50。 */
const CARD_SIDE = 50;
/** 列表装不下才提示拖动；这一格在 W28 让给了缺爱心的指引条，所以由列表自己决定亮不亮。 */
const SCROLL_HINT_Y = -285;

export function buildHabitatList(
  panel: Node,
  entries: readonly HabitatPet[],
  panelWidth: number,
  focusPetId: string | undefined,
  cardColor: Color,
  fire: RowAction,
  onCare: RowCommand,
  onRehome: RowCommand,
): HabitatRow[] {
  const viewW = panelWidth - 80;
  const cardW = panelWidth - CARD_SIDE * 2;
  const scrollNode = createNode(panel, 'HabitatScroll', 0, viewW, VIEW_H);
  const view = createNode(scrollNode, 'HabitatView', 0, viewW, VIEW_H);
  view.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
  const content = new Node('HabitatContent');
  content.parent = view;
  const transform = content.addComponent(UITransform);
  transform.setContentSize(cardW, Math.max(VIEW_H, entries.length * HABITAT_CARD_H));
  transform.setAnchorPoint(0.5, 1);
  content.setPosition(0, VIEW_H / 2, 0);
  const rows = entries.map((entry, index) =>
    buildHabitatRow(content, index, entry, cardW, fire, onCare, onRehome, cardColor),
  );

  const scroll = scrollNode.addComponent(ScrollView);
  scroll.content = content;
  scroll.vertical = true;
  scroll.horizontal = false;
  scroll.brake = 0.72;
  if (entries.length > 2) {
    addLabel(panel, 'HabitatScrollHint', '上下拖动可以翻看全部宠物', SCROLL_HINT_Y, { size: 20, color: PALETTE.sub });
  }
  focusRow(scroll, entries, focusPetId);
  return rows;
}

/** 从大厅点进来时把被点的那只滚到视口中间；列表装不下才有滚动，装得下就原地不动。 */
function focusRow(scroll: ScrollView, entries: readonly HabitatPet[], focusPetId?: string): void {
  if (!focusPetId) {
    return;
  }
  const index = entries.findIndex((entry) => entry.petId === focusPetId);
  const max = entries.length * HABITAT_CARD_H - VIEW_H;
  if (index < 0 || max <= 0) {
    return;
  }
  const offset = Math.max(0, Math.min(max, (index + 0.5) * HABITAT_CARD_H - VIEW_H / 2));
  scroll.scrollToOffset(new Vec2(0, offset), 0);
}
