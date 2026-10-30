// STATUS: implemented, W3 领养页（好感度门槛 + 领养位 + 分享/广告腾位）
import { _decorator, Component, Label, Node, UITransform } from 'cc';
import { CaseSession } from './CaseSession';
import { AFFECTION_THRESHOLD, Hospital } from './Hospital';
import { Save } from '../cache/Save';
import { GameState } from '../core/GameFSM';
import { goState } from '../core/SceneFlow';
import { AdQuota, adButtonText } from '../cache/AdQuota';
import { showAd } from '../net/AdGateway';
import { Track } from '../track/Track';
import { addButton, addLabel, addProgressBar, PALETTE, setButtonState } from '../ui/SceneUI';

const { ccclass } = _decorator;

@ccclass('Adoption')
export class Adoption extends Component {
  private hint: Label | null = null;
  private body: Node | null = null;
  private petId = '';

  protected start(): void {
    const item = CaseSession.current;
    if (!item) {
      void goState(GameState.Lobby, 'Lobby');
      return;
    }
    this.petId = item.petId;
    addLabel(this.node, 'PageTitle', '领 养', 300, { size: 44 });
    addLabel(this.node, 'PetName', `${item.petName} 抬头看着你。`, 245, { size: 30 });
    this.hint = addLabel(this.node, 'Hint', '', 95, {
      size: 22, color: PALETTE.sub, width: 1000,
    });
    this.render();
  }

  private render(): void {
    this.body?.destroy();
    const body = new Node('AdoptionBody');
    body.parent = this.node;
    body.addComponent(UITransform).setContentSize(1280, 720);
    this.body = body;
    const affection = Hospital.affection(this.petId);
    addLabel(body, 'AffectionLabel', `好感度 ${affection}/${AFFECTION_THRESHOLD}`, 195, { size: 26 });
    const redraw = addProgressBar(body, 'AffectionBar', 150, 620, 36);
    redraw(Math.min(1, affection / AFFECTION_THRESHOLD));
    if (affection < AFFECTION_THRESHOLD) {
      addLabel(body, 'LockHint', '好感度还不够，分享给好友可以 +1', 40, {
        size: 22, color: PALETTE.sub, width: 900,
      });
      addButton(
        body,
        'ShareAffection',
        '分享助力 +1 好感（本地模拟）',
        -60,
        () => this.shareAffection(),
        PALETTE.secondary,
        560,
      );
      addButton(body, 'LaterButton', '稍后再说', -170, () => this.leave(), PALETTE.secondary, 360);
      return;
    }
    addLabel(body, 'SlotLabel', `领养位 ${Hospital.adoptedCount}/${Hospital.slots}`, 40, {
      size: 24,
      color: PALETTE.sub,
    });
    if (!Hospital.slotFree) {
      addButton(
        body,
        'ShareSlot',
        '分享腾位（本地模拟）',
        -50,
        () => this.shareSlot(),
        PALETTE.secondary,
        480,
      );
      const adButton = addButton(
        body,
        'AdSlot',
        '',
        -150,
        () => void this.adSlot(),
        PALETTE.accent,
        480,
      );
      setButtonState(
        adButton,
        AdQuota.canShow('free_slot'),
        adButtonText('free_slot', '看广告腾位'),
        PALETTE.accent,
      );
      addButton(body, 'LaterSlot', '稍后再说', -250, () => this.leave(), PALETTE.secondary, 300);
      return;
    }
    addButton(body, 'AdoptButton', '领养它', -60, () => this.adopt(), PALETTE.primary);
    addButton(body, 'LaterButton', '稍后再说', -170, () => this.leave(), PALETTE.secondary);
  }

  private adopt(): void {
    const item = CaseSession.current;
    if (!item) {
      return;
    }
    if (!Hospital.slotFree) {
      this.setHint('领养位已满，先分享或看广告腾一个位置');
      this.render();
      return;
    }
    CaseSession.adopted = true;
    Save.markAdopted(item.petId);
    Track.track('adoption_complete', { caseId: item.caseId, petId: item.petId, slots: Hospital.slots });
    void goState(GameState.Result, 'Result');
  }

  private shareAffection(): void {
    Track.track('friend_assist', { target: 'affection', petId: this.petId });
    Hospital.addAffection(this.petId, 1);
    this.render();
    this.setHint('好友助力 +1 好感（本地模拟）');
  }

  private shareSlot(): void {
    Track.track('friend_assist', { target: 'adoption_slot' });
    Hospital.addSlotBonus(1);
    this.render();
    this.setHint('好友帮忙腾出一个领养位（本地模拟）');
  }

  private async adSlot(): Promise<void> {
    const result = await showAd('free_slot');
    if (!result.ok) {
      this.setHint('今日广告腾位次数已用完，可用分享腾位');
      this.render();
      return;
    }
    Hospital.addSlotBonus(1);
    this.render();
    this.setHint('广告奖励：领养位 +1');
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
