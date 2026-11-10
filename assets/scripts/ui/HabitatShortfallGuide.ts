// STATUS: implemented, W28 P1-2 高级粮缺爱心时的可点出路（小屋里唯一能放下 48 高胶囊的空档，就是引导行那一格）
// 同一行只说一件事：缺爱心时「去哪弄爱心」比「怎么摸怎么喂」更要紧，指引亮起就把引导语压下去。
import { Label, Node } from 'cc';
import { addEarnGuide } from './EarnGuide';
import { shortfallText } from './HabitatTapActions';

const GUIDE_Y = 272;
/** 与引导语同宽档：面板 1040 减去两侧留白，比默认 520 宽一截，读起来不至于折行。 */
const GUIDE_W = 640;

export interface HeartsGuideHandle {
  sync(): void;
}

/** 建一次、按状态反复装卸：文案与跳转目标都在装载时现算，避免领完成就还写着「还有 3 档没领」。 */
export function attachHeartsGuide(
  panel: Node,
  hint: () => Label | null,
  dismiss: () => void,
): HeartsGuideHandle {
  let node: Node | null = null;
  const showHint = (visible: boolean): void => {
    const label = hint();
    if (label && label.isValid) {
      label.node.active = visible;
    }
  };
  const handle: HeartsGuideHandle = {
    sync(): void {
      const blocked = shortfallText('premium') !== null;
      if (blocked && !node) {
        node = addEarnGuide(panel, GUIDE_Y, 'hearts', dismiss, 'HabitatHeartsGuide', GUIDE_W);
      } else if (!blocked && node) {
        node.destroy();
        node = null;
      }
      showHint(!blocked);
    },
  };
  handle.sync();
  return handle;
}
