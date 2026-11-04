// STATUS: implemented, W25 P2-C 后院网格（三列两行 6 格；开垦按钮只在还有下一块时可用）
import { Node } from 'cc';
import { todayKey } from '../cache/DayKey';
import { GardenConfig } from '../config/GardenConfig';
import { unlockPlot } from '../game/GardenCraft';
import { gardenNow, gardenView } from '../game/GardenModel';
import { buildPlotCard, GardenPlotCard, PLOT_CARD_H, PLOT_CARD_W, PlotHost } from './GardenPlotCard';
import { playStaggerIn } from './MotionKit';
import { addUIButton, setUIButtonState } from './UIButton';
import { COLORS } from './Tokens';

const GAP = 14;
const COLUMNS = 3;
/** 网格下沿在 -177，开垦键顶边 -179，底部刚好落在内容区 -220 内。 */
const UNLOCK_Y = -199;

export interface GardenPlotsHandle {
  refresh(): void;
}

export function buildGardenPlots(
  content: Node,
  panel: Node,
  notify: (text: string) => void,
  changed: () => void,
): GardenPlotsHandle {
  const host: PlotHost = { picker: panel, notify, changed };
  // garden.json 锁死 6 格：三列两行是唯一能放进 440 内容区且按钮不压边界的排法。
  const total = Math.min(GardenConfig.plots.max, 6);
  const stepX = PLOT_CARD_W + GAP;
  const stepY = PLOT_CARD_H + GAP;
  const cards: GardenPlotCard[] = [];
  for (let index = 0; index < total; index++) {
    const column = index % COLUMNS;
    const row = Math.floor(index / COLUMNS);
    // 两行以内容区中心对称：+92 / -92，卡片高 170，行间余 14。
    cards.push(buildPlotCard(content, index, (column - 1) * stepX, (0.5 - row) * stepY, host));
  }

  const unlock = addUIButton(
    content,
    'GardenUnlock',
    '',
    () => {
      const result = unlockPlot();
      notify(result.text);
      if (result.kind === 'done') {
        changed();
      } else {
        handle.refresh();
      }
    },
    { y: UNLOCK_Y, width: 440, height: 40, color: COLORS.sage, fontSize: 19 },
  );

  const handle: GardenPlotsHandle = { refresh };

  function refresh(): void {
    const view = gardenView();
    const now = gardenNow();
    const day = todayKey();
    cards.forEach((card) => card.sync(view, now, day));
    const cost = view.nextCost;
    const text = cost === null ? '后院已开满' : `开垦新地块 · ${cost} 金币（还差 ${view.locked} 块）`;
    setUIButtonState(unlock, cost !== null, text, COLORS.sage);
  }

  refresh();
  playStaggerIn(cards.map((card) => card.node));
  return handle;
}
