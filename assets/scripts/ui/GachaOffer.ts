// STATUS: implemented, W25 P1-A 寻访支付入口（金币 / 广告两条路径，余额不足当场置灰并说明差额）
import { Node, UITransform } from 'cc';
import { COPY, fillCopy } from '../config/CopyText';
import { addUIButton, setUIButtonState } from './UIButton';
import { safeAreaBottom, screenHeight, screenWidth } from './ScreenMetrics';
import { COLORS } from './Tokens';

export interface GachaOfferHandle {
  root: Node;
  setCoins(coins: number): void;
  setBusy(busy: boolean): void;
  show(): void;
  hide(): void;
}

export function buildGachaOffer(
  stage: Node,
  cost: number,
  onPay: () => void,
  onWatchAd: () => void,
): GachaOfferHandle {
  const bottom = -screenHeight() / 2 + safeAreaBottom();
  const root = new Node('GachaOffer');
  root.parent = stage;
  root.addComponent(UITransform).setContentSize(screenWidth(), 300);
  const pay = addUIButton(root, 'GachaPay', fillCopy(COPY.gachaPay, { cost }), onPay, {
    y: bottom + 172,
    width: 520,
    height: 92,
    color: COLORS.clay,
    fontSize: 32,
  });
  const ad = addUIButton(root, 'GachaAd', COPY.gachaAd, onWatchAd, {
    y: bottom + 70,
    width: 520,
    height: 74,
    color: COLORS.sage,
    fontSize: 28,
  });
  let balance = 0;
  let busy = false;

  function refresh(): void {
    const enough = balance >= cost;
    setUIButtonState(
      pay,
      enough && !busy,
      enough ? fillCopy(COPY.gachaPay, { cost }) : fillCopy(COPY.gachaNoCoinsShort, { cost }),
    );
    setUIButtonState(ad, !busy, COPY.gachaAd);
  }
  refresh();

  return {
    root,
    setCoins: (value: number) => {
      balance = value;
      refresh();
    },
    setBusy: (value: boolean) => {
      busy = value;
      refresh();
    },
    show: () => {
      root.active = true;
    },
    hide: () => {
      root.active = false;
    },
  };
}
