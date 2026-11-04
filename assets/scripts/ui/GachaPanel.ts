// STATUS: implemented, W25 P1-A 街头寻访面板（全屏遮罩 + 场景挂载 + 配置预热，流程状态在 GachaFlow）
import { BlockInputEvents, Color, Node } from 'cc';
import { Save } from '../cache/Save';
import { CharacterConfig } from '../config/CharacterConfig';
import { CONFIG_BUNDLE } from '../config/ConfigLoader';
import { COPY } from '../config/CopyText';
import { GachaConfig } from '../config/GachaConfig';
import { Res } from '../core/Res';
import { Track } from '../track/Track';
import { GachaFlow, GachaHost } from './GachaFlow';
import { buildGachaOffer } from './GachaOffer';
import { mountGachaStage } from './GachaStage';
import { addRect } from './SceneUI';
import { leftEdgeX, safeAreaTop, screenHeight, screenWidth } from './ScreenMetrics';
import { COLORS } from './Tokens';
import { addUIButton } from './UIButton';

let overlay: Node | null = null;

export function isGachaOpen(): boolean {
  return !!overlay && overlay.isValid;
}

export function closeGachaPanel(): void {
  if (!overlay) {
    return;
  }
  overlay.destroy();
  overlay = null;
}

export function openGachaPanel(parent: Node, host: GachaHost): void {
  if (overlay) {
    return;
  }
  Save.load();
  Track.track('gacha_open');
  overlay = addRect(parent, 'GachaOverlay', 0, screenWidth(), screenHeight(), new Color(38, 28, 22, 200));
  overlay.addComponent(BlockInputEvents);
  overlay.setSiblingIndex(parent.children.length - 1);
  const root = overlay;
  let flow: GachaFlow | null = null;
  const stage = mountGachaStage(root, () => flow?.tapBox());
  addUIButton(stage.root, 'GachaClose', '关闭', closeGachaPanel, {
    y: screenHeight() / 2 - safeAreaTop() - 42,
    x: leftEdgeX(66, 20),
    width: 132,
    height: 56,
    color: COLORS.sub,
    fontSize: 24,
  });
  stage.setCoins(Save.coins);
  stage.playEnter();

  flow = new GachaFlow({
    stage,
    host,
    isAlive: () => !!overlay && overlay.isValid,
    close: closeGachaPanel,
  });
  const active = flow;

  void ensureConfigs().then((ready) => {
    if (!overlay || !overlay.isValid) {
      return;
    }
    if (!ready) {
      stage.setHint(COPY.gachaMissing);
      return;
    }
    const offer = buildGachaOffer(
      stage.root,
      GachaConfig.costCoins,
      () => active.spendCoins(),
      () => active.watchAd(),
      () => active.spendTicket(),
    );
    offer.setCoins(Save.coins);
    offer.setTickets(Save.itemCount(GachaConfig.ticketItem));
    active.attach(offer);
    stage.setHint(COPY.gachaReady);
  });
}

/** cases 分包可能还没回来：先借引用加载，配置读完就还回去，不把引用计数留给面板。 */
function ensureConfigs(): Promise<boolean> {
  const owned = !Res.isLoaded(CONFIG_BUNDLE);
  return Res.loadBundle(CONFIG_BUNDLE).then((loaded) => {
    if (!loaded) {
      return false;
    }
    return Promise.all([CharacterConfig.load(), GachaConfig.load()]).then((states) => {
      if (owned) {
        Res.release(CONFIG_BUNDLE);
      }
      return states.every(Boolean);
    });
  });
}
