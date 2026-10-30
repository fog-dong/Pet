// STATUS: implemented, W5 领养页（好感度门槛 + 三种腾位路径 + 用户主动分享）
import { _decorator, Button, Component, Label, Node } from 'cc';
import { CaseSession } from './CaseSession';
import { AFFECTION_THRESHOLD, Hospital } from './Hospital';
import { GameState } from '../core/GameFSM';
import { goState } from '../core/SceneFlow';
import { showAd } from '../net/AdGateway';
import { Track } from '../track/Track';
import { addLabel, PALETTE, setButtonState } from '../ui/SceneUI';
import { renderAdoptionBody } from '../ui/AdoptionView';
import { assistHint, requestAssist } from './AdoptionActions';

const { ccclass } = _decorator;
const WAIT_SECONDS = 10;

@ccclass('Adoption')
export class Adoption extends Component {
  private hint: Label | null = null;
  private body: Node | null = null;
  private waitButton: Button | null = null;
  private petId = '';
  private waiting = 0;

  protected start(): void {
    const item = CaseSession.current;
    if (!item) {
      void goState(GameState.Lobby, 'Lobby');
      return;
    }
    this.petId = item.petId;
    addLabel(this.node, 'PageTitle', '领 养', 300, { size: 44 });
    addLabel(this.node, 'PetName', `${item.petName} 抬头看着你。`, 245, { size: 30 });
    this.hint = addLabel(this.node, 'Hint', '', 95, { size: 22, color: PALETTE.sub, width: 1000 });
    this.render();
  }

  private render(): void {
    this.body?.destroy();
    this.body = renderAdoptionBody(
      this.node,
      {
        affection: Hospital.affection(this.petId),
        threshold: AFFECTION_THRESHOLD,
        slots: Hospital.slots,
        adoptedCount: Hospital.adoptedCount,
        waiting: this.waiting,
        slotFree: Hospital.slotFree,
      },
      {
        shareAssist: () => this.shareAssist(),
        shareSlot: () => this.shareSlot(),
        adSlot: () => void this.adSlot(),
        startWait: () => this.startWait(),
        adopt: () => this.adopt(),
        leave: () => this.leave(),
      },
    );
    this.waitButton = this.body.getChildByName('WaitSlot')?.getComponent(Button) ?? null;
  }

  private shareAssist(): void {
    const outcome = requestAssist('affection');
    if (outcome === 'granted') {
      Hospital.addAffection(this.petId, 1);
      this.render();
    }
    this.setHint(assistHint(outcome));
  }

  private shareSlot(): void {
    const outcome = requestAssist('adoption_slot');
    if (outcome === 'granted') {
      Hospital.addSlotBonus(1);
      this.render();
      this.setHint('好友帮忙腾出一个领养位（本地模拟）');
      return;
    }
    this.setHint(assistHint(outcome));
  }

  private async adSlot(): Promise<void> {
    const result = await showAd('free_slot');
    if (!result.ok) {
      this.render();
      this.setHint('今日广告腾位次数已用完，可继续等待或稍后再来');
      return;
    }
    Hospital.addSlotBonus(1);
    this.render();
    this.setHint('广告奖励：领养位 +1');
  }

  private startWait(): void {
    if (this.waiting > 0) {
      return;
    }
    this.waiting = WAIT_SECONDS;
    Track.track('slot_wait_start', { seconds: WAIT_SECONDS });
    this.render();
    this.schedule(this.tickWait, 1);
  }

  private tickWait(): void {
    this.waiting -= 1;
    if (this.waiting > 0) {
      if (this.waitButton) {
        setButtonState(this.waitButton, false, `等待中 ${this.waiting}s`);
      }
      return;
    }
    this.unschedule(this.tickWait);
    Hospital.addSlotBonus(1);
    this.render();
    this.setHint('自然恢复：领养位 +1');
  }

  private adopt(): void {
    const item = CaseSession.current;
    if (!item) {
      return;
    }
    if (!Hospital.slotFree) {
      this.render();
      this.setHint('领养位已满，可以分享求助、看广告或等一会儿');
      return;
    }
    CaseSession.markAdopted(item.petId);
    void goState(GameState.Result, 'Result');
  }

  private leave(): void {
    void goState(GameState.Result, 'Result');
  }

  private setHint(text: string): void {
    if (this.hint) {
      this.hint.string = text;
    }
  }
}
