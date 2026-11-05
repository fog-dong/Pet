// STATUS: implemented, W26 P2-E 后院 TAB：地块状态摘要 + 草药库存 + 打开种植面板（复用 GardenPanel，不新做一套播种逻辑）
import { Label, Node } from 'cc';
import { gardenNow, gardenView, herbStock } from '../game/GardenModel';
import { addDockEntry, addDockNote, addDockPills, DockBody, DockContext } from './DockKit';

const ENTRY_TEXT = '打理后院';
const EMPTY_STOCK = '药篓还空着，收获一次就有存货了';
/** 库存一行只列前三样：再多也放不下，且玩家关心的本来就是攒得最多的那几味。 */
const STOCK_LIMIT = 3;

export function buildGardenBody(parent: Node, ctx: DockContext): DockBody {
  const pills = addDockPills(parent, ['', '', ''], 0, ctx.width);
  addDockEntry(parent, 'GardenButton', ENTRY_TEXT, () => ctx.menu('GardenButton'), 1, ctx.width);
  const stock = addDockNote(parent, 'GardenStockNote', '', 2, ctx.width);
  return { node: parent, refresh: () => paint(pills, stock) };
}

/** 墙钟口径沿用 GardenModel，坞这边不自己算成熟，避免和面板判出两种结果。 */
function paint(pills: readonly Label[], stock: Label): void {
  const plots = gardenView().plots;
  const now = gardenNow();
  const counts = [0, 0, 0];
  plots.forEach((plot) => {
    if (!plot.cropId) {
      counts[2] += 1;
      return;
    }
    counts[plot.readyAt > 0 && plot.readyAt <= now ? 0 : 1] += 1;
  });
  const texts = [`成熟 ${counts[0]}`, `生长 ${counts[1]}`, `空地 ${counts[2]}`];
  pills.forEach((pill, index) => {
    pill.string = texts[index] ?? '';
  });
  stock.string = stockText();
}

function stockText(): string {
  const rows = herbStock()
    .filter((item) => item.count > 0)
    .slice(0, STOCK_LIMIT)
    .map((item) => `${item.crop.name} ×${item.count}`);
  return rows.length > 0 ? `药篓：${rows.join('　')}` : EMPTY_STOCK;
}
