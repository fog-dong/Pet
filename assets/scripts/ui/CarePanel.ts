// STATUS: implemented, W25 P2-D 日常护理面板（左立绘右两张卡；按钮置灰时原因单独一行，不抢动作名）
import { BlockInputEvents, Color, Node } from 'cc';
import { HabitatPet } from '../cache/HabitatCodec';
import { Save } from '../cache/Save';
import { CareQuota } from '../cache/CareQuota';
import { GroomingConfig } from '../config/GroomingConfig';
import { findCareEntry } from '../game/CareModel';
import { dewormPet, dewormStatus } from '../game/Deworming';
import { nailStatus } from '../game/NailCare';
import { addCareCard, CareCardHandle } from './CareCard';
import { CareProfileHandle, buildCareProfile } from './CareProfile';
import { addCard } from './PanelKit';
import { enterPanel, leavePanel } from './PanelMotion';
import { addLabel, addRect } from './SceneUI';
import { fitWidth, screenHeight, screenWidth } from './ScreenMetrics';
import { showToast } from './Toast';
import { addUIButton } from './UIButton';
import { COLORS, HEX, tint } from './Tokens';
import { closeNailGame, openNailGame } from './NailGame';
import { addEarnGuide } from './EarnGuide';

const PANEL_H = 760;

let overlay: Node | null = null;
let petId = '';
let toastHost: Node | null = null;
let changed: ((entry: HabitatPet) => void) | undefined;
let profile: CareProfileHandle | null = null;
let nailCard: CareCardHandle | null = null;
let dewormCard: CareCardHandle | null = null;
let dewormGuide: Node | null = null;

export function closeCarePanel(): void {
  closeNailGame();
  leavePanel(overlay);
  overlay = null;
  toastHost = null;
  changed = undefined;
  profile = null;
  nailCard = null;
  dewormCard = null;
  dewormGuide = null;
}

export function openCarePanel(parent: Node, id: string, onChanged?: (entry: HabitatPet) => void): void {
  closeCarePanel();
  Save.load();
  if (!findCareEntry(id)) {
    showToast(parent, '这只宠物还没领养');
    return;
  }
  petId = id;
  toastHost = parent;
  changed = onChanged;
  overlay = addRect(parent, 'CareOverlay', 0, screenWidth(), screenHeight(), new Color(0, 0, 0, 150));
  overlay.addComponent(BlockInputEvents);
  overlay.setSiblingIndex(parent.children.length - 1);
  const panel = addCard(overlay, 'CarePanel', 0, fitWidth(1040, 30), PANEL_H, { color: tint(HEX.wall) });
  addLabel(panel, 'CareTitle', '日 常 护 理', 340, { size: 36 });
  profile = buildCareProfile(panel, id);

  const nail = GroomingConfig.nail;
  nailCard = addCareCard(panel, 'CareNail', 155, 150, {
    title: '剪指甲',
    desc: `点掉 ${nail.dots} 个红点，点错会中断`,
    meta: `${nail.costCoins} 金币 · 清洁 +${nail.cleanGain} / 心情 +${nail.moodGain}`,
    action: '开始剪指甲',
    color: COLORS.mist,
    onFire: startNail,
  });
  const deworm = GroomingConfig.deworm;
  dewormCard = addCareCard(panel, 'CareDeworm', 155, -60, {
    title: '驱虫',
    desc: '消耗 1 支驱虫药剂（后院合成）',
    meta: `每日 ${deworm.dailyLimit} 次 · 清洁 +${deworm.cleanGain} / 心情 +${deworm.moodGain}`,
    action: '用驱虫药剂',
    color: COLORS.sage,
    onFire: runDeworm,
  });
  // W28 P1-1：置灰那行只说"没药"，不说去哪拿；卡片下方补一条可点出路，窄到 330 跟卡同宽。
  dewormGuide = addEarnGuide(panel, -215, 'medicine', closeCarePanel, 'CareDewormGuide', 330);
  dewormGuide.setPosition(155, -215, 0);

  addUIButton(panel, 'CareClose', '关 闭', closeCarePanel, {
    y: -320,
    width: 260,
    height: 68,
    color: COLORS.sage,
    fontSize: 28,
  });
  refresh();
  enterPanel(overlay, panel);
}

/** 每次结算后重读：属性、两项置灰原因、药剂余量都可能同时变。 */
function refresh(): void {
  const entry = findCareEntry(petId);
  if (!entry) {
    closeCarePanel();
    return;
  }
  profile?.sync(entry);
  const nailWhy = nailStatus(petId);
  const remain = CareQuota.remaining('nail', GroomingConfig.nail.dailyLimit);
  nailCard?.update(!nailWhy, nailWhy ?? (remain === null ? '不限次数' : `今日剩 ${remain} 次`));
  const dewormWhy = dewormStatus(petId);
  const stock = Save.itemCount(GroomingConfig.deworm.itemId);
  // 出路由下方可点指引承担，卡内原因只说缺什么，避免同一句话出现两遍
  const dewormReason = dewormWhy === null
    ? `药剂 ${stock} 支 · 每日 ${GroomingConfig.deworm.dailyLimit} 次`
    : stock <= 0 ? '没有驱虫药剂' : dewormWhy;
  dewormCard?.update(!dewormWhy, dewormReason);
  if (dewormGuide && dewormGuide.isValid) {
    dewormGuide.active = stock <= 0;
  }
}

function startNail(): void {
  if (!overlay) {
    return;
  }
  const blocked = nailStatus(petId);
  if (blocked) {
    notify(blocked);
    return;
  }
  openNailGame(overlay, petId, (outcome) => {
    notify(outcome.text);
    refresh();
    if (outcome.kind !== 'blocked') {
      changed?.(outcome.entry);
    }
  });
}

function runDeworm(): void {
  const outcome = dewormPet(petId);
  notify(outcome.text);
  refresh();
  if (outcome.kind !== 'blocked') {
    changed?.(outcome.entry);
  }
}

function notify(text: string): void {
  if (toastHost) {
    showToast(toastHost, text);
  }
}
