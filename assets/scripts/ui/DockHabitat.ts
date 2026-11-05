// STATUS: implemented, W26 P2-E 小屋 TAB：宠物数量与照护摘要 + 进小屋 + 装修入口 + 送养入口
// 列表本身仍是全屏面板（内部是绝对坐标，塞不进 180–300 高的坞），坞只给读数与三个入口。
import { Label, Node } from 'cc';
import { habitatList } from '../game/HabitatModel';
import { rehomeQuote } from '../game/RehomeModel';
import { addDockEntry, addDockPills, addDockSubs, DockBody, DockContext } from './DockKit';
import { COLORS } from './Tokens';
import { openThemePicker } from './HabitatThemePanel';
import { openRehomePanel } from './RehomePanel';

const ENTRY_TEXT = '宠物小屋';
/** 与 HabitatDecay 的低值档、散步带的睡眠档同一个数，三处口径不能各写一套。 */
const NEED_CARE = 30;

export function buildHabitatBody(parent: Node, ctx: DockContext): DockBody {
  const pills = addDockPills(parent, ['', '', ''], 0, ctx.width);
  addDockEntry(parent, 'HabitatButton', ENTRY_TEXT, () => ctx.menu('HabitatButton'), 1, ctx.width);
  addDockSubs(
    parent,
    [
      { name: 'HabitatThemeButton', text: '装 修', color: COLORS.mist, onClick: () => openThemePicker(ctx.host, ctx.host, ctx.changed, ctx.changed) },
      { name: 'RehomeButton', text: '送 养', color: COLORS.mist, onClick: () => openRehome(ctx) },
    ],
    2,
    ctx.width,
  );
  return { node: parent, refresh: () => paintPills(pills) };
}

function paintPills(pills: readonly Label[]): void {
  const entries = habitatList();
  const need = entries.filter((entry) => Math.min(entry.hunger, entry.cleanliness, entry.mood) < NEED_CARE).length;
  const texts = [`小屋 ${entries.length} 只`, `待照顾 ${need}`, `可送养 ${rehomable(entries.map((entry) => entry.petId)).length}`];
  pills.forEach((pill, index) => {
    pill.string = texts[index] ?? '';
  });
}

/** 只有在小屋里、且品种在送养档位池里的才算可送养，判定完全交给 rehomeQuote。 */
function rehomable(ids: readonly string[]): string[] {
  return ids.filter((id) => !!rehomeQuote(id));
}

function openRehome(ctx: DockContext): void {
  const ids = rehomable(habitatList().map((entry) => entry.petId));
  if (ids.length === 0) {
    ctx.toast('还没有符合条件的小家伙，先把它养好~');
    return;
  }
  openRehomePanel(ctx.host, ids[0], ctx.changed, ctx.changed);
}
