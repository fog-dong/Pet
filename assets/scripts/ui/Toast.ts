// STATUS: implemented, W16 P0 胶囊 Toast（淡入上浮、停留 2.2s、淡出；同时只留一条，避免叠字）
import { Color, Node, tween, UIOpacity, Vec3 } from 'cc';
import { makeLabel } from './FontKit';
import { addPill, createBox } from './PanelKit';
import { COLORS, DURATION } from './Tokens';

let active: Node | null = null;

export interface ToastOptions {
  y?: number;
  hold?: number;
}

/** y 缺省放在屏幕下方约 1/4 处；调用方一般是场景根节点。 */
export function showToast(parent: Node, text: string, options: ToastOptions = {}): Node {
  if (active && active.isValid) {
    active.destroy();
  }
  const width = Math.min(620, Math.max(300, text.length * 25 + 72));
  const y = options.y ?? -320;
  const root = createBox(parent, 'Toast', y, width, 64);
  addPill(root, 'ToastPill', 0, width, 64, new Color(62, 50, 42, 228));
  makeLabel(root, 'ToastLabel', text, 0, { size: 24, width: width - 40, color: COLORS.white });
  root.setPosition(0, y - 8, 0);
  const opacity = root.addComponent(UIOpacity);
  opacity.opacity = 0;
  tween(root).to(DURATION.toastIn, { position: new Vec3(0, y, 0) }, { easing: 'sineOut' }).start();
  tween(opacity).to(DURATION.toastIn, { opacity: 255 }).start();
  tween(opacity)
    .delay(DURATION.toastIn + (options.hold ?? DURATION.toastHold))
    .to(DURATION.toastOut, { opacity: 0 })
    .call(() => {
      if (root.isValid) {
        root.destroy();
      }
    })
    .start();
  active = root;
  return root;
}
