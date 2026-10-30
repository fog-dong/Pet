// STATUS: implemented, W3 可选按钮行（运行时构建，选中/未选中重绘）
import { Label, Node, UITransform } from 'cc';
import { addButton, paintRect, PALETTE } from './SceneUI';

export interface Choice {
  value: string;
  node: Node;
  label: Label;
}

export interface ChoiceRowOptions {
  y: number;
  x0: number;
  gap: number;
  width?: number;
  onClick: (value: string) => void;
}

export function addChoiceRow(
  parent: Node,
  prefix: string,
  options: readonly string[],
  opts: ChoiceRowOptions,
): Choice[] {
  const width = opts.width ?? 300;
  return options.map((value, index) => {
    const name = `${prefix}${index}`;
    const button = addButton(
      parent,
      name,
      value,
      opts.y,
      () => opts.onClick(value),
      PALETTE.secondary,
      width,
      78,
      opts.x0 + opts.gap * index,
    );
    const label = button.node.getChildByName(`${name}Label`)?.getComponent(Label);
    if (!label) {
      throw new Error(`choice label missing: ${name}`);
    }
    return { value, node: button.node, label };
  });
}

/** 重绘选中态；text 回调用于在按钮上追加库存角标。 */
export function paintChoices(
  choices: readonly Choice[],
  selected: string,
  text?: (value: string) => string,
): void {
  for (const choice of choices) {
    const size = choice.node.getComponent(UITransform)?.contentSize;
    const color = choice.value === selected ? PALETTE.primary : PALETTE.secondary;
    paintRect(choice.node, size?.width ?? 300, size?.height ?? 78, color);
    if (text) {
      choice.label.string = text(choice.value);
    }
  }
}
