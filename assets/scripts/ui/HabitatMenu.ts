// STATUS: implemented, W20-2 小屋互动菜单（点宠物行弹出；喂食/洗澡/抚摸三枚按钮 + 抚摸 ±4° 摇摆）
import { Color, Node, Tween, tween } from 'cc';
import { HabitatPet } from '../cache/HabitatCodec';
import { Quality } from '../config/Quality';
import { CharacterConfig } from '../config/CharacterConfig';
import { HabitatAction, HabitatOutcome, HABITAT_ACTIONS, HABITAT_RULES } from '../game/HabitatModel';
import { PetVisual } from '../game/PetVisual';
import { Sfx } from '../game/Sfx';
import { addCard } from './PanelKit';
import { addLabel } from './SceneUI';
import { floatText } from './FloatText';
import { COLORS } from './Tokens';
import { addUIButton } from './UIButton';

const MENU_W = 560;
const MENU_H = 400;
const PORTRAIT_X = -150;
const PORTRAIT_Y = -20;
const BUTTON_X = 95;
const BUTTON_Y = [70, -10, -90];
const ROCK_ANGLE = 4;

const TINT: Record<HabitatAction, Color> = {
  feed: COLORS.gold,
  bath: COLORS.mist,
  pet: COLORS.clay,
};

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
  addLabel(host, 'HabitatMenuTitle', look ? `和 ${look.name} 互动` : '和它互动', 160, { size: 30, width: MENU_W - 80 });

  const visual = PetVisual.mount(host, 170, false);
  visual.node.setPosition(PORTRAIT_X, PORTRAIT_Y, 0);
  visual.apply(entry.petId);

  HABITAT_ACTIONS.forEach((action, index) => {
    const rule = HABITAT_RULES[action];
    addUIButton(host, `${action}_btn`, `${rule.label} · ${rule.costText}`, () => {
      trigger(action, visual, onAction(action), notify);
    }, {
      y: BUTTON_Y[index],
      x: BUTTON_X,
      width: 300,
      height: 74,
      color: TINT[action],
      fontSize: 26,
    });
  });
  addUIButton(host, 'HabitatMenuClose', '收 起', () => closeHabitatMenu(), {
    y: -160,
    width: 220,
    height: 64,
    color: COLORS.sage,
    fontSize: 24,
  });
}

function trigger(
  action: HabitatAction,
  visual: PetVisual,
  outcome: HabitatOutcome,
  notify: (text: string) => void,
): void {
  if (!menu) {
    return;
  }
  if (outcome.kind === 'blocked') {
    notify(outcome.text);
    return;
  }
  const root = menu;
  const rule = outcome.rule;
  Sfx.play(rule.cue);
  floatText(root, rule.floatText, PORTRAIT_X, PORTRAIT_Y + 70, TINT[action]);
  if (action === 'pet') {
    playRock(visual.contentNode);
  }
}

/** 一次性 ±4° 摇摆：借用行为层的幅度上限，但不像 recover 那样无限循环。 */
function playRock(content: Node | null): void {
  if (!content || Quality.low) {
    return;
  }
  Tween.stopAllByTarget(content);
  content.angle = 0;
  tween(content)
    .to(0.12, { angle: -ROCK_ANGLE })
    .to(0.12, { angle: ROCK_ANGLE })
    .to(0.12, { angle: -ROCK_ANGLE })
    .to(0.12, { angle: 0 })
    .start();
}
