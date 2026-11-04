// STATUS: implemented, W25 P2-C 单块地卡片（锁定/空地/生长/成熟四态；按钮只转发，数值全在数据层）
import { Label, Node } from 'cc';
import { todayKey } from '../cache/DayKey';
import { Save } from '../cache/Save';
import { GardenConfig } from '../config/GardenConfig';
import { gardenNow, GardenView, gardenView } from '../game/GardenModel';
import { harvestPlot, seedPlot, waterPlot } from '../game/GardenPlanting';
import { formatRemaining, isReady, limitLeft, quotaUsed, waterUsed } from '../game/GardenRules';
import { paintSoil, PlotVisual, SOIL_H, SOIL_W } from './GardenArt';
import { openSeedPicker } from './GardenSeedPicker';
import { addCard, createBox } from './PanelKit';
import { addLabel } from './SceneUI';
import { addUIButton, setUIButtonState } from './UIButton';
import { COLORS } from './Tokens';

export const PLOT_CARD_W = 190;
export const PLOT_CARD_H = 170;

const TITLE_W = PLOT_CARD_W - 16;
const TITLE_Y = 64;
const SOIL_Y = 8;
const SUB_Y = -36;
const BTN_Y = -64;

export interface PlotHost {
  picker: Node;
  notify(text: string): void;
  changed(): void;
}

export interface GardenPlotCard {
  index: number;
  node: Node;
  sync(view: GardenView, now: number, day: string): void;
}

export function buildPlotCard(parent: Node, index: number, x: number, y: number, host: PlotHost): GardenPlotCard {
  const node = addCard(parent, `GardenPlot_${index}`, y, PLOT_CARD_W, PLOT_CARD_H, { x, color: COLORS.paper });
  const title = addLabel(node, `GardenPlotTitle_${index}`, '空地', TITLE_Y, { size: 17, width: TITLE_W });
  const soil = createBox(node, `GardenSoil_${index}`, SOIL_Y, SOIL_W, SOIL_H);
  const sub = addLabel(node, `GardenPlotSub_${index}`, '', SUB_Y, { size: 13, color: COLORS.sub, width: TITLE_W });
  let card: GardenPlotCard;
  const button = addUIButton(node, `GardenPlotBtn_${index}`, '播种', () => act(card, host), {
    y: BTN_Y,
    width: 150,
    height: 38,
    color: COLORS.sage,
    fontSize: 17,
  });
  // 两行状态文字都不允许换行撑高卡片，长文案交给 SHRINK 缩字号。
  title.overflow = Label.Overflow.SHRINK;
  sub.overflow = Label.Overflow.SHRINK;

  function sync(view: GardenView, now: number, day: string): void {
    const plot = view.plots[index];
    if (!plot) {
      paintSoil(soil, 'locked', '#A8C3A0');
      title.string = '未开垦';
      sub.string = index === view.plots.length && view.nextCost !== null ? `下一块 ${view.nextCost} 金币` : '先开前一块';
      // 不能隐藏按钮：软投影是同级节点，藏了按钮会留一块灰影。
      setUIButtonState(button, false, '待开垦', COLORS.sub);
      return;
    }
    button.node.active = true;
    const crop = plot.cropId ? GardenConfig.cropById(plot.cropId) : null;
    if (!crop) {
      paintSoil(soil, 'empty', '#A8C3A0');
      title.string = '空地';
      sub.string = '选一包种子';
      setUIButtonState(button, true, '播种', COLORS.sage);
      return;
    }
    const ready = isReady(plot, now);
    const visual: PlotVisual = ready ? 'ready' : 'growing';
    paintSoil(soil, visual, crop.tint);
    if (!ready) {
      const used = waterUsed(plot, day);
      const left = limitLeft(used, GardenConfig.water.dailyLimitPerPlot);
      title.string = `${crop.name} · ${formatRemaining(plot.readyAt - now)}`;
      sub.string = `浇水 ${used}/${GardenConfig.water.dailyLimitPerPlot} · 产 ${crop.yield} 株`;
      setUIButtonState(button, left > 0, '浇水', COLORS.mist);
      return;
    }
    const left = limitLeft(quotaUsed(Save.snapshot().gardenQuota, day).harvest, GardenConfig.dailyHarvestLimit);
    title.string = `${crop.name} · 可收获`;
    sub.string = left > 0 ? `可收 ${crop.yield} 株` : '今日收获已满';
    setUIButtonState(button, left > 0, '收获', COLORS.clay);
  }

  card = { index, node, sync };
  return card;
}

/** 一次点击只做一件事：空地选种，成熟收获，其余浇水；失败原因原样交给 Toast。 */
function act(card: GardenPlotCard, host: PlotHost): void {
  const plot = gardenView().plots[card.index];
  if (!plot) {
    return;
  }
  if (!plot.cropId) {
    openSeedPicker(host.picker, (cropId) => {
      const result = seedPlot(card.index, cropId);
      host.notify(result.text);
      if (result.kind === 'done') {
        host.changed();
      } else {
        card.sync(gardenView(), gardenNow(), todayKey());
      }
    });
    return;
  }
  const result = isReady(plot, gardenNow()) ? harvestPlot(card.index) : waterPlot(card.index);
  host.notify(result.text);
  if (result.kind === 'done') {
    host.changed();
  } else {
    card.sync(gardenView(), gardenNow(), todayKey());
  }
}
