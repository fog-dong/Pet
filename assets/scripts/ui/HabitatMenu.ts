// STATUS: implemented, W20-2 小屋互动菜单（点宠物行弹出；W23-2 四枚互动按钮，反馈表现在 HabitatFeedback.ts）
import { Button, Node } from 'cc';
import { HabitatPet } from '../cache/HabitatCodec';
import { PetQuota } from '../cache/PetQuota';
import { CharacterConfig } from '../config/CharacterConfig';
import { affordShortfall, HabitatOutcome } from '../game/HabitatModel';
import { HabitatAction, HabitatRule, HABITAT_ACTIONS, HABITAT_RULES } from '../game/HabitatRules';
import { PetVisual } from '../game/PetVisual';
import { addCard } from './PanelKit';
import { addLifeSummary } from './LifeBadge';
import { addLabel } from './SceneUI';
import { COLORS } from './Tokens';
import { addUIButton, setUIButtonState } from './UIButton';
import { playFeedback, PORTRAIT_X, PORTRAIT_Y, TINT } from './HabitatFeedback';

const MENU_W = 560;
/** 四枚按钮比三枚多占 78，标题与寿命摘要同步上移；面板本身 780 高，装得下。 */
const MENU_H = 490;
const BUTTON_X = 105;
const BUTTON_Y = [104, 26, -52, -130];

/** 一枚互动按钮 + 它的规则，置灰判定要同时读两者。 */
interface MenuRow {
  action: HabitatAction;
  rule: HabitatRule;
  button: Button;
}

let menu: Node | null = null;

export function closeHabitatMenu(): void {
  if (!menu) {
    return;
  }
  const root = menu;
  const parent = root.parent;
  menu = null;
  root.destroy();
  // 投影是 addCard 挂在父节点上的兄弟节点，不跟着卡片一起销毁就会留一团灰影。
  parent?.getChildByName(`${root.name}Shadow`)?.destroy();
}

/** 挂在遮罩之上、Toast 之下：由调用方在最后追加，所以天然压住列表面板。 */
export function openHabitatMenu(
  parent: Node,
  entry: HabitatPet,
  onAction: (action: HabitatAction) => HabitatOutcome,
  notify: (text: string) => void,
): void {
  closeHabitatMenu();
  const look = CharacterConfig.petById(entry.petId);
  const host = addCard(parent, 'HabitatMenu', 0, MENU_W, MENU_H, { color: COLORS.paper });
  menu = host;
  addLabel(host, 'HabitatMenuTitle', look ? `和 ${look.name} 互动` : '和它互动', 200, { size: 30, width: MENU_W - 80 });
  addLifeSummary(host, 'HabitatMenuLife', 156, entry, look);

  const visual = PetVisual.mount(host, 170, false);
  visual.node.setPosition(PORTRAIT_X, PORTRAIT_Y, 0);
  visual.apply(entry.petId);

  const rows: MenuRow[] = [];
  HABITAT_ACTIONS.forEach((action, index) => {
    const rule = HABITAT_RULES[action];
    const button = addUIButton(host, `${action}_btn`, buttonText(rule), () => {
      const outcome = onAction(action);
      if (outcome.kind === 'done') {
        syncAffordability(rows);
      }
      playFeedback(host, action, visual, outcome, notify);
    }, {
      y: BUTTON_Y[index],
      x: BUTTON_X,
      width: 340,
      height: 74,
      color: TINT[action],
      fontSize: 26,
    });
    rows.push({ action, rule, button });
  });
  syncAffordability(rows);
  addUIButton(host, 'HabitatMenuClose', '收 起', () => closeHabitatMenu(), {
    y: -200,
    width: 220,
    height: 64,
    color: COLORS.sage,
    fontSize: 24,
  });
}

/**
 * 买不起或次数用完的直接置灰并写明原因（方案 §2.4）：金币、爱心各自显示所需数额，
 * 抚摸免费但每天 3 次，用完写「今日抚摸次数已用完」——不留「点了才知道不行」的死胡同。
 */
function syncAffordability(rows: readonly MenuRow[]): void {
  rows.forEach(({ action, rule, button }) => {
    const shortfall = affordShortfall(rule);
    setUIButtonState(button, !shortfall, shortfall ? greyText(rule.label, shortfall) : buttonText(rule), TINT[action]);
  });
}

/**
 * 置灰也保留动作名：四键同灰时只剩「金币不足（需 30）／（需 20）」这类数额，
 * 玩家分不清哪个是哪个动作。配额提示本身自带动作名，不再重复拼。
 * 长文案由 FontKit 的 SHRINK 溢出自动缩字号，340 px 宽不会被撑破。
 */
function greyText(label: string, shortfall: string): string {
  return shortfall.includes(label) ? shortfall : `${label}·${shortfall}`;
}

/** 限次动作把今日余量写进按钮，玩家不必自己数今天摸了几下（全局计数，不分宠物）。 */
function buttonText(rule: HabitatRule): string {
  const remain = PetQuota.remaining(rule.dailyLimit);
  const base = `${rule.label} · ${rule.costText}`;
  return remain === null ? base : `${base}（剩 ${remain}）`;
}
