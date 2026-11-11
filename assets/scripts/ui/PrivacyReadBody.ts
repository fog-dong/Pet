// STATUS: implemented, W33 隐私只读正文：滚动区 + 「平台隐私指引」打开反馈 + 关闭
import { Node } from 'cc';
import { WxPrivacy } from '../net/Privacy';
import { addLabel, createNode, PALETTE } from './SceneUI';
import { addDialogButton, buildDocScroll, buttonX, panelH, panelW } from './PrivacyDialogKit';

export function buildPrivacyReadBody(panel: Node, onClose: () => void): Node {
  const body = createNode(panel, 'PrivacyReadBody', 0, panelW(), panelH());
  buildDocScroll(body, 60);
  addLabel(body, 'PrivacyScrollHint', '上下滑动可查看完整协议', -108, {
    size: 19,
    color: PALETTE.sub,
  });
  const hint = addLabel(body, 'ContractHint', '', -150, { size: 20, color: PALETTE.sub, width: panelW() - 160 });
  // 平台页可能整页盖住游戏、也可能直接失败：先给「正在打开」，再按回调改成成功/失败提示。
  const setHint = (text: string): void => {
    if (hint.isValid) {
      hint.string = text;
    }
  };
  addDialogButton(body, 'PrivacyContract', '平台隐私指引', -buttonX(), PALETTE.secondary, () => {
    setHint('正在打开平台隐私指引…');
    WxPrivacy.openContract((result) => {
      setHint(
        result === 'opened'
          ? '已打开平台隐私指引，返回后可在本页继续阅读。'
          : '当前环境无法打开平台隐私指引，请以上方正文为准。',
      );
    });
  });
  addDialogButton(body, 'PrivacyClose', '关 闭', buttonX(), PALETTE.primary, onClose);
  return body;
}
