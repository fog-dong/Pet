// STATUS: implemented, W26 P2-E 诊疗 TAB：街头寻访主入口 + 医院等级/床位/领养位摘要 + 扩建入口
// 只做只读摘要与跳转：床位与领养位的扣减仍归 Hospital 与病例链，坞不写存档。
import { Label, Node } from 'cc';
import { COPY } from '../config/CopyText';
import { Hospital } from '../game/Hospital';
import { addDockPills, addDockSubs, DockBody, DockContext, dockEntrySize } from './DockKit';
import { lobbyDockRow } from './LobbyDockLayout';
import { decorateButton } from './UIButton';

export function buildClinicBody(parent: Node, ctx: DockContext): DockBody {
  const pills = addDockPills(parent, ['', '', ''], 0, ctx.width);
  mountStart(parent, ctx);
  addDockSubs(
    parent,
    [{ name: 'HospitalButton', text: '医院扩建', onClick: () => ctx.menu('HospitalButton') }],
    2,
    ctx.width,
  );
  return { node: parent, refresh: () => paintPills(pills) };
}

/** 三枚摘要：等级一眼看出小院长到什么程度，床位与领养位是当天还能不能继续救的依据。 */
function paintPills(pills: readonly Label[]): void {
  const texts = [
    `医院 Lv.${Hospital.level}`,
    `床位 ${Hospital.bedsOccupied}/${Hospital.bedsOwned}`,
    `领养位 ${Hospital.adoptedCount}/${Hospital.slots}`,
  ];
  pills.forEach((pill, index) => {
    pill.string = texts[index] ?? '';
  });
}

/** 场景里的 Start 是 @property 绑好的按钮，搬进坞复用：埋点、点击回调与节点名都不变。 */
function mountStart(parent: Node, ctx: DockContext): void {
  const button = ctx.startButton;
  if (!button) {
    return;
  }
  const size = dockEntrySize();
  button.node.parent = parent;
  decorateButton(button, COPY.lobbyStart, {
    y: lobbyDockRow(1),
    width: ctx.width,
    height: size.height,
    fontSize: size.fontSize,
  });
}
