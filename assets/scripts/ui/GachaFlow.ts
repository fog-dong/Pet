// STATUS: implemented, W25 P1-A 寻访流程（支付 → 纸箱 → 开箱 → 结果；结果页由本模块挂载与销毁）
import { Node } from 'cc';
import { Save } from '../cache/Save';
import { COPY, fillCopy } from '../config/CopyText';
import { GachaConfig } from '../config/GachaConfig';
import { drawGacha, GachaDraw } from '../game/Gacha';
import { Ad } from '../net/Ad';
import { Track } from '../track/Track';
import { GachaOfferHandle } from './GachaOffer';
import { mountGachaResult } from './GachaResult';
import { GachaStageHandle } from './GachaStage';

type Phase = 'offer' | 'searching' | 'revealing' | 'result';

export interface GachaHost {
  refreshStats(): void;
  onIntake(petId: string): void;
}

export interface GachaFlowDeps {
  stage: GachaStageHandle;
  host: GachaHost;
  isAlive(): boolean;
  close(): void;
}

export class GachaFlow {
  private phase: Phase = 'offer';
  private offer: GachaOfferHandle | null = null;
  private result: Node | null = null;

  constructor(private readonly deps: GachaFlowDeps) {}

  attach(offer: GachaOfferHandle): void {
    this.offer = offer;
  }

  spendCoins(): void {
    if (this.phase !== 'offer' || !this.offer) {
      return;
    }
    if (!Save.spendCoins(GachaConfig.costCoins)) {
      const diff = Math.max(1, GachaConfig.costCoins - Save.coins);
      this.deps.stage.setHint(fillCopy(COPY.gachaNoCoins, { n: diff }));
      this.offer.setCoins(Save.coins);
      return;
    }
    Track.track('gacha_pay_coins', { cost: GachaConfig.costCoins });
    this.deps.host.refreshStats();
    this.deps.stage.setCoins(Save.coins);
    this.enterSearch();
  }

  watchAd(): void {
    if (this.phase !== 'offer' || !this.offer) {
      return;
    }
    this.offer.setBusy(true);
    this.deps.stage.setHint(COPY.gachaAdLoading);
    Track.track('gacha_ad_request', { scene: GachaConfig.adScene });
    void Ad.showRewarded(GachaConfig.adScene).then((result) => {
      if (!this.deps.isAlive() || !this.offer) {
        return;
      }
      this.offer.setBusy(false);
      if (result.ok || result.degraded) {
        this.enterSearch();
        return;
      }
      this.deps.stage.setHint(fillCopy(COPY.gachaAdUnavailable, { cost: GachaConfig.costCoins }));
      this.offer.setCoins(Save.coins);
    });
  }

  tapBox(): void {
    if (this.phase !== 'searching') {
      return;
    }
    this.phase = 'revealing';
    const draw = drawGacha();
    if (!draw) {
      this.phase = 'offer';
      this.offer?.show();
      this.deps.stage.setHint(COPY.gachaMissing);
      return;
    }
    Track.track('gacha_box_tap', { tier: draw.tier });
    this.deps.stage.setCoins(Save.coins);
    this.deps.host.refreshStats();
    this.deps.stage.reveal(draw, () => this.showResult(draw));
  }

  private enterSearch(): void {
    this.phase = 'searching';
    this.offer?.hide();
    this.deps.stage.setHint(COPY.gachaSearch);
    this.deps.stage.beginSearch();
  }

  private showResult(draw: GachaDraw): void {
    this.phase = 'result';
    this.result = mountGachaResult(this.deps.stage.root, draw, {
      primary: () => {
        if (!this.deps.isAlive()) {
          return;
        }
        if (draw.isNew) {
          this.deps.close();
          this.deps.host.onIntake(draw.petId);
          return;
        }
        this.reset();
      },
      secondary: this.deps.close,
    });
  }

  private reset(): void {
    this.result?.destroy();
    this.result = null;
    this.deps.stage.reset();
    this.deps.stage.setHint(COPY.gachaReady);
    this.deps.stage.setCoins(Save.coins);
    this.offer?.setCoins(Save.coins);
    this.offer?.show();
    this.phase = 'offer';
  }
}
